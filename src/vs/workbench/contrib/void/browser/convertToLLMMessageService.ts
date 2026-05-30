import { Disposable } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorsOrder } from '../../../common/editor.js';
import { ChatMessage } from '../common/chatThreadServiceTypes.js';
import { getIsReasoningEnabledState, getReservedOutputTokenSpace, getModelCapabilities } from '../common/modelCapabilities.js';
import { reParsedToolXMLString, chat_systemMessage } from '../common/prompt/prompts.js';
import { AnthropicLLMChatMessage, AnthropicReasoning, GeminiLLMChatMessage, LLMChatMessage, LLMFIMMessage, OpenAILLMChatMessage, RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ChatMode, FeatureName, ModelSelection, ProviderName } from '../common/voidSettingsTypes.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { ITerminalToolService } from './terminalToolService.js';
import { IVoidModelService } from '../common/voidModelService.js';
import { URI } from '../../../../base/common/uri.js';
import { EndOfLinePreference } from '../../../../editor/common/model.js';
import { ToolName } from '../common/toolsServiceTypes.js';
import { IMCPService } from '../common/mcpService.js';
import { ISemanticIndexService } from '../common/semanticIndex/semanticIndexTypes.js';
import { IWorkspaceRulesService } from './workspaceRulesService.js';
import { ISkillsService } from './skillsService.js';

import { LLM_EMPTY_TEXT_PLACEHOLDER } from '../common/chatMessageContent.js'

/** @deprecated use LLM_EMPTY_TEXT_PLACEHOLDER */
export const EMPTY_MESSAGE = LLM_EMPTY_TEXT_PLACEHOLDER



type SimpleLLMMessage = {
	role: 'tool';
	content: string;
	id: string;
	name: ToolName;
	rawParams: RawToolParamsObj;
} | {
	role: 'user';
	content: string;
	images?: Array<{ data: string; mimeType: string }>;
} | {
	role: 'assistant';
	content: string;
	anthropicReasoning: AnthropicReasoning[] | null;
	reasoning: string | null;
}



const CHARS_PER_TOKEN = 4 // assume abysmal chars per token
const TRIM_TO_LEN = 120




// convert messages as if about to send to openai
/*
reference - https://platform.openai.com/docs/guides/function-calling#function-calling-steps
openai MESSAGE (role=assistant):
"tool_calls":[{
	"type": "function",
	"id": "call_12345xyz",
	"function": {
	"name": "get_weather",
	"arguments": "{\"latitude\":48.8566,\"longitude\":2.3522}"
}]

openai RESPONSE (role=user):
{   "role": "tool",
	"tool_call_id": tool_call.id,
	"content": str(result)    }

also see
openai on prompting - https://platform.openai.com/docs/guides/reasoning#advice-on-prompting
openai on developer system message - https://cdn.openai.com/spec/model-spec-2024-05-08.html#follow-the-chain-of-command
*/


const prepareMessages_openai_tools = (messages: SimpleLLMMessage[]): AnthropicOrOpenAILLMMessage[] => {

	const newMessages: OpenAILLMChatMessage[] = [];

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		if (currMsg.role !== 'tool') {
			if (currMsg.role === 'assistant' && currMsg.reasoning) {
				// DeepSeek and other OAI-compat thinking models require prior
				// reasoning_content echoed back. Build a clean object -- do NOT spread
				// currMsg, which would leak anthropicReasoning/reasoning as junk fields.
				newMessages.push({ role: 'assistant', content: currMsg.content, reasoning_content: currMsg.reasoning } as any)
			} else if (currMsg.role === 'user' && currMsg.images && currMsg.images.length > 0) {
				// Multimodal user message with images -- use content array format
				const contentParts: any[] = [{ type: 'text', text: currMsg.content }];
				for (const img of currMsg.images) {
					contentParts.push({
						type: 'image_url',
						image_url: { url: `data:${img.mimeType};base64,${img.data}` }
					});
				}
				newMessages.push({ role: 'user', content: contentParts } as any);
			} else if (currMsg.role === 'assistant') {
				newMessages.push({ role: 'assistant', content: currMsg.content })
			} else {
				newMessages.push({ role: 'user', content: currMsg.content })
			}
			continue
		}

		// edit previous assistant message to have called the tool
		const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : undefined
		if (prevMsg?.role === 'assistant') {
			prevMsg.tool_calls = [{
				type: 'function',
				id: currMsg.id,
				function: {
					name: currMsg.name,
					arguments: JSON.stringify(currMsg.rawParams)
				}
			}]
		} else {
			// Orphaned tool message (no preceding assistant with tool_calls) — skip it
			// This happens when a stream is aborted mid-tool-call
			continue
		}

		// add the tool
		newMessages.push({
			role: 'tool',
			tool_call_id: currMsg.id,
			content: currMsg.content,
		})
	}
	return newMessages

}



// convert messages as if about to send to anthropic
/*
https://docs.anthropic.com/en/docs/build-with-claude/tool-use#tool-use-examples
anthropic MESSAGE (role=assistant):
"content": [{
	"type": "text",
	"text": "<thinking>I need to call the get_weather function, and the user wants SF, which is likely San Francisco, CA.</thinking>"
}, {
	"type": "tool_use",
	"id": "toolu_01A09q90qw90lq917835lq9",
	"name": "get_weather",
	"input": { "location": "San Francisco, CA", "unit": "celsius" }
}]
anthropic RESPONSE (role=user):
"content": [{
	"type": "tool_result",
	"tool_use_id": "toolu_01A09q90qw90lq917835lq9",
	"content": "15 degrees"
}]


Converts:
assistant: ...content
tool: (id, name, params)
->
assistant: ...content, call(name, id, params)
user: ...content, result(id, content)
*/

type AnthropicOrOpenAILLMMessage = AnthropicLLMChatMessage | OpenAILLMChatMessage

const prepareMessages_anthropic_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {
	const newMessages: (AnthropicLLMChatMessage | (SimpleLLMMessage & { role: 'tool' }))[] = messages;

	for (let i = 0; i < messages.length; i += 1) {
		const currMsg = messages[i]

		// add anthropic reasoning
		if (currMsg.role === 'assistant') {
			if (currMsg.anthropicReasoning && supportsAnthropicReasoning) {
				const content = currMsg.content
				newMessages[i] = {
					role: 'assistant',
					content: content ? [...currMsg.anthropicReasoning, { type: 'text' as const, text: content }] : currMsg.anthropicReasoning
				}
			}
			else {
				newMessages[i] = {
					role: 'assistant',
					content: currMsg.content,
					// strip away anthropicReasoning
				}
			}
			continue
		}

		if (currMsg.role === 'user') {
			newMessages[i] = {
				role: 'user',
				content: currMsg.content,
			}
			continue
		}

		if (currMsg.role === 'tool') {
			// add anthropic tools
			const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : undefined

			// make it so the assistant called the tool
			if (prevMsg?.role === 'assistant') {
				if (typeof prevMsg.content === 'string') {
					prevMsg.content = prevMsg.content.trim()
						? [{ type: 'text', text: prevMsg.content }]
						: []
				}
				prevMsg.content.push({ type: 'tool_use', id: currMsg.id, name: currMsg.name, input: currMsg.rawParams })
			}

			// turn each tool into a user message with tool results at the end
			newMessages[i] = {
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: currMsg.id, content: currMsg.content }]
			}
			continue
		}

	}

	// we just removed the tools
	return newMessages as AnthropicLLMChatMessage[]
}


const prepareMessages_XML_tools = (messages: SimpleLLMMessage[], supportsAnthropicReasoning: boolean): AnthropicOrOpenAILLMMessage[] => {

	const llmChatMessages: AnthropicOrOpenAILLMMessage[] = [];
	for (let i = 0; i < messages.length; i += 1) {

		const c = messages[i]
		const next = 0 <= i + 1 && i + 1 <= messages.length - 1 ? messages[i + 1] : null

		if (c.role === 'assistant') {
			// if called a tool (message after it), re-add its XML to the message
			// alternatively, could just hold onto the original output, but this way requires less piping raw strings everywhere
			let content: AnthropicOrOpenAILLMMessage['content'] = c.content
			if (next?.role === 'tool') {
				content = `${content}\n\n${reParsedToolXMLString(next.name, next.rawParams)}`
			}

			// anthropic reasoning
			if (c.anthropicReasoning && supportsAnthropicReasoning) {
				content = content ? [...c.anthropicReasoning, { type: 'text' as const, text: content }] : c.anthropicReasoning
			}
			const msg: any = { role: 'assistant', content }
			if (c.reasoning && !supportsAnthropicReasoning) {
				msg.reasoning_content = c.reasoning
			}
			llmChatMessages.push(msg)
		}
		// add user or tool to the previous user message
		else if (c.role === 'user' || c.role === 'tool') {
			if (c.role === 'tool')
				c.content = `<${c.name}_result>\n${c.content}\n</${c.name}_result>`

			if (llmChatMessages.length === 0 || llmChatMessages[llmChatMessages.length - 1].role !== 'user')
				llmChatMessages.push({
					role: 'user',
					content: c.content
				})
			else
				llmChatMessages[llmChatMessages.length - 1].content += '\n\n' + c.content
		}
	}
	return llmChatMessages
}


// --- CHAT ---

const prepareOpenAIOrAnthropicMessages = ({
	messages: messages_,
	systemMessage,
	aiInstructions,
	supportsSystemMessage,
	specialToolFormat,
	supportsAnthropicReasoning,
	contextWindow,
	reservedOutputTokenSpace,
}: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
}): { messages: AnthropicOrOpenAILLMMessage[], separateSystemMessage: string | undefined } => {

	reservedOutputTokenSpace = Math.max(
		contextWindow * 1 / 2, // reserve at least 1/4 of the token window length
		reservedOutputTokenSpace ?? 4_096 // defaults to 4096
	)
	let messages: (SimpleLLMMessage | { role: 'system', content: string })[] = deepClone(messages_)

	// ================ system message ================
	// A COMPLETE HACK: last message is system message for context purposes

	const sysMsgParts: string[] = []
	if (aiInstructions) sysMsgParts.push(`GUIDELINES (from the user's .voidrules file):\n${aiInstructions}`)
	if (systemMessage) sysMsgParts.push(systemMessage)
	const combinedSystemMessage = sysMsgParts.join('\n\n')

	messages.unshift({ role: 'system', content: combinedSystemMessage })

	// ================ conversation summary (condense long history) ================
	// If conversation exceeds 60% of context, compress middle messages into a summary.
	// Preserves: system message (idx 0), first user message (idx 1), and last 6 messages.
	const totalCharsBefore = messages.reduce((sum, m) => sum + m.content.length, 0)
	const contextBudgetChars = (contextWindow - (reservedOutputTokenSpace ?? 4096)) * CHARS_PER_TOKEN
	if (totalCharsBefore > contextBudgetChars * 0.6 && messages.length > 10) {
		const preserveStart = 2 // system + first user
		const preserveEnd = 6
		const middleStart = preserveStart
		const middleEnd = messages.length - preserveEnd

		if (middleEnd > middleStart + 2) {
			// Look for a Status Block in the middle section (most recent one)
			let statusBlockSummary: string | null = null
			for (let si = middleEnd - 1; si >= middleStart; si--) {
				const content = messages[si].content
				if (content.includes('## Status') && content.includes('**Task:**')) {
					statusBlockSummary = content
					break
				}
			}

			// Build condensed summary of dropped messages
			const droppedCount = middleEnd - middleStart
			const summaryParts: string[] = [
				`[Conversation condensed: ${droppedCount} messages summarized to save context]`,
			]
			if (statusBlockSummary) {
				summaryParts.push(`Last known state:\n${statusBlockSummary.slice(0, 2000)}`)
			} else {
				// Extract key info from dropped messages
				const keyPoints: string[] = []
				for (let si = middleStart; si < middleEnd; si++) {
					const m = messages[si]
					if (m.role === 'user' && m.content.length > 10) {
						keyPoints.push(`- User: "${m.content.slice(0, 100)}..."`)
					}
				}
				if (keyPoints.length > 0) {
					summaryParts.push(`Key requests in condensed section:\n${keyPoints.slice(0, 8).join('\n')}`)
				}
			}

			const summaryMessage = { role: 'system' as const, content: summaryParts.join('\n\n') }
			messages = [
				...messages.slice(0, preserveStart),
				summaryMessage,
				...messages.slice(middleEnd),
			]
		}
	}

	// ================ trim ================
	messages = messages.map(m => ({ ...m, content: m.role !== 'tool' ? m.content.trim() : m.content }))

	type MesType = (typeof messages)[0]

	// ================ fit into context ================

	// the higher the weight, the higher the desire to truncate - TRIM HIGHEST WEIGHT MESSAGES
	const alreadyTrimmedIdxes = new Set<number>()
	const weight = (message: MesType, messages: MesType[], idx: number) => {
		const base = message.content.length

		let multiplier: number
		multiplier = 1 + (messages.length - 1 - idx) / messages.length // slow rampdown from 2 to 1 as index increases
		if (message.role === 'user') {
			multiplier *= 1
		}
		else if (message.role === 'system') {
			multiplier *= .01 // very low weight
		}
		else {
			multiplier *= 10 // llm tokens are far less valuable than user tokens
		}

		// any already modified message should not be trimmed again
		if (alreadyTrimmedIdxes.has(idx)) {
			multiplier = 0
		}
		// 1st and last messages should be very low weight
		if (idx <= 1 || idx >= messages.length - 1 - 3) {
			multiplier *= .05
		}
		return base * multiplier
	}

	const _findLargestByWeight = (messages_: MesType[]) => {
		let largestIndex = -1
		let largestWeight = -Infinity
		for (let i = 0; i < messages.length; i += 1) {
			const m = messages[i]
			const w = weight(m, messages_, i)
			if (w > largestWeight) {
				largestWeight = w
				largestIndex = i
			}
		}
		return largestIndex
	}

	let totalLen = 0
	for (const m of messages) { totalLen += m.content.length }
	const charsNeedToTrim = totalLen - Math.max(
		(contextWindow - reservedOutputTokenSpace) * CHARS_PER_TOKEN, // can be 0, in which case charsNeedToTrim=everything, bad
		5_000 // ensure we don't trim at least 5k chars (just a random small value)
	)


	// <----------------------------------------->
	// 0                      |    |             |
	//                        |    contextWindow |
	//                     contextWindow - maxOut|putTokens
	//                                          totalLen
	let remainingCharsToTrim = charsNeedToTrim
	let i = 0

	while (remainingCharsToTrim > 0) {
		i += 1
		if (i > 100) break

		const trimIdx = _findLargestByWeight(messages)
		const m = messages[trimIdx]

		// if can finish here, do
		const numCharsWillTrim = m.content.length - TRIM_TO_LEN
		if (numCharsWillTrim > remainingCharsToTrim) {
			// trim remainingCharsToTrim + '...'.length chars
			m.content = m.content.slice(0, m.content.length - remainingCharsToTrim - '...'.length).trim() + '...'
			break
		}

		remainingCharsToTrim -= numCharsWillTrim
		m.content = m.content.substring(0, TRIM_TO_LEN - '...'.length) + '...'
		alreadyTrimmedIdxes.add(trimIdx)
	}

	// ================ system message hack ================
	const newSysMsg = messages.shift()!.content


	// ================ tools and anthropicReasoning ================
	// SYSTEM MESSAGE HACK: we shifted (removed) the system message role, so now SimpleLLMMessage[] is valid

	let llmChatMessages: AnthropicOrOpenAILLMMessage[] = []
	if (!specialToolFormat) { // XML tool behavior
		llmChatMessages = prepareMessages_XML_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'anthropic-style') {
		llmChatMessages = prepareMessages_anthropic_tools(messages as SimpleLLMMessage[], supportsAnthropicReasoning)
	}
	else if (specialToolFormat === 'openai-style') {
		llmChatMessages = prepareMessages_openai_tools(messages as SimpleLLMMessage[])
	}
	const llmMessages = llmChatMessages


	// ================ system message add as first llmMessage ================

	let separateSystemMessageStr: string | undefined = undefined

	// if supports system message
	if (supportsSystemMessage) {
		if (supportsSystemMessage === 'separated')
			separateSystemMessageStr = newSysMsg
		else if (supportsSystemMessage === 'system-role')
			llmMessages.unshift({ role: 'system', content: newSysMsg }) // add new first message
		else if (supportsSystemMessage === 'developer-role')
			llmMessages.unshift({ role: 'developer', content: newSysMsg }) // add new first message
	}
	// if does not support system message
	else {
		const newFirstMessage = {
			role: 'user',
			content: `<SYSTEM_MESSAGE>\n${newSysMsg}\n</SYSTEM_MESSAGE>\n${llmMessages[0].content}`
		} as const
		llmMessages.splice(0, 1) // delete first message
		llmMessages.unshift(newFirstMessage) // add new first message
	}


	// ================ no empty message ================
	for (let i = 0; i < llmMessages.length; i += 1) {
		const currMsg: AnthropicOrOpenAILLMMessage = llmMessages[i]
		const nextMsg: AnthropicOrOpenAILLMMessage | undefined = llmMessages[i + 1]

		if (currMsg.role === 'tool') continue

		// if content is a string, replace string with empty msg
		if (typeof currMsg.content === 'string') {
			currMsg.content = currMsg.content || EMPTY_MESSAGE
		}
		else {
			// allowed to be empty if has a tool in it or following it
			if (currMsg.content.find(c => c.type === 'tool_result' || c.type === 'tool_use')) {
				currMsg.content = currMsg.content.filter(c => !(c.type === 'text' && !c.text)) as any
				continue
			}
			if (nextMsg?.role === 'tool') continue

			// replace any empty text entries with empty msg, and make sure there's at least 1 entry
			for (const c of currMsg.content) {
				if (c.type === 'text') c.text = c.text || EMPTY_MESSAGE
			}
			if (currMsg.content.length === 0) currMsg.content = [{ type: 'text', text: EMPTY_MESSAGE }]
		}
	}

	return {
		messages: llmMessages,
		separateSystemMessage: separateSystemMessageStr,
	} as const
}




type GeminiUserPart = (GeminiLLMChatMessage & { role: 'user' })['parts'][0]
type GeminiModelPart = (GeminiLLMChatMessage & { role: 'model' })['parts'][0]
const prepareGeminiMessages = (messages: AnthropicLLMChatMessage[]) => {
	let latestToolName: ToolName | undefined = undefined
	const messages2: GeminiLLMChatMessage[] = messages.map((m): GeminiLLMChatMessage | null => {
		if (m.role === 'assistant') {
			if (typeof m.content === 'string') {
				return { role: 'model', parts: [{ text: m.content }] }
			}
			else {
				const parts: GeminiModelPart[] = m.content.map((c): GeminiModelPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'tool_use') {
						latestToolName = c.name
						return { functionCall: { id: c.id, name: c.name, args: c.input } }
					}
					else return null
				}).filter(m => !!m)
				return { role: 'model', parts, }
			}
		}
		else if (m.role === 'user') {
			if (typeof m.content === 'string') {
				return { role: 'user', parts: [{ text: m.content }] } satisfies GeminiLLMChatMessage
			}
			else {
				const parts: GeminiUserPart[] = m.content.map((c): GeminiUserPart | null => {
					if (c.type === 'text') {
						return { text: c.text }
					}
					else if (c.type === 'tool_result') {
						if (!latestToolName) return null
						return { functionResponse: { id: c.tool_use_id, name: latestToolName, response: { output: c.content } } }
					}
					else return null
				}).filter(m => !!m)
				return { role: 'user', parts, }
			}

		}
		else return null
	}).filter(m => !!m)

	return messages2
}


const prepareMessages = (params: {
	messages: SimpleLLMMessage[],
	systemMessage: string,
	aiInstructions: string,
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated',
	specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined,
	supportsAnthropicReasoning: boolean,
	contextWindow: number,
	reservedOutputTokenSpace: number | null | undefined,
	providerName: ProviderName
}): { messages: LLMChatMessage[], separateSystemMessage: string | undefined } => {

	const specialFormat = params.specialToolFormat // this is just for ts stupidness

	// if need to convert to gemini style of messaes, do that (treat as anthropic style, then convert to gemini style)
	if (params.providerName === 'gemini' || specialFormat === 'gemini-style') {
		const res = prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat === 'gemini-style' ? 'anthropic-style' : undefined })
		const messages = res.messages as AnthropicLLMChatMessage[]
		const messages2 = prepareGeminiMessages(messages)
		return { messages: messages2, separateSystemMessage: res.separateSystemMessage }
	}

	return prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat })
}




export interface IConvertToLLMMessageService {
	readonly _serviceBrand: undefined;
	prepareLLMSimpleMessages: (opts: { simpleMessages: SimpleLLMMessage[], systemMessage: string, modelSelection: ModelSelection | null, featureName: FeatureName }) => { messages: LLMChatMessage[], separateSystemMessage: string | undefined }
	prepareLLMChatMessages: (opts: { chatMessages: ChatMessage[], chatMode: ChatMode, modelSelection: ModelSelection | null }) => Promise<{ messages: LLMChatMessage[], separateSystemMessage: string | undefined }>
	prepareFIMMessage(opts: { messages: LLMFIMMessage, }): { prefix: string, suffix: string, stopTokens: string[] }
}

export const IConvertToLLMMessageService = createDecorator<IConvertToLLMMessageService>('ConvertToLLMMessageService');


class ConvertToLLMMessageService extends Disposable implements IConvertToLLMMessageService {
	_serviceBrand: undefined;

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IVoidModelService private readonly voidModelService: IVoidModelService,
		@IMCPService private readonly mcpService: IMCPService,
		@ISemanticIndexService private readonly semanticIndexService: ISemanticIndexService,
		@IWorkspaceRulesService private readonly workspaceRulesService: IWorkspaceRulesService,
		@ISkillsService private readonly skillsService: ISkillsService,
	) {
		super()
		// Eagerly load workspace instruction files (AGENTS.md, copilot-instructions, CLAUDE.md, .voidrules)
		// so they're cached before the first chat. Re-warmup whenever workspace folders change.
		void this._ensureInstructionWarmup();
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => {
			this._instructionWarmup = null;
			void this._ensureInstructionWarmup();
		}));
	}

	// Workspace instruction files that V3Code auto-injects into every chat.
	// Matches the convention used by GitHub Copilot, Cursor, Claude Code, and Void.
	// Loaded async via voidModelService.getModelSafe (no need for the user to open them).
	private static readonly WORKSPACE_INSTRUCTION_PATHS: ReadonlyArray<string> = [
		'AGENTS.md',
		'.github/copilot-instructions.md',
		'.github/AGENTS.md',
		'CLAUDE.md',
		'.voidrules',
		'.v3coderules',
		'.cursorrules',
	];

	// Per-instruction-file hard cap (chars) — total cap enforced in chat_systemMessage via prepareMessages budgeting.
	private static readonly MAX_INSTRUCTION_FILE_CHARS = 16_000;

	private _instructionWarmup: Promise<void> | null = null;

	private async _warmupWorkspaceInstructionModels(): Promise<void> {
		const folders = this.workspaceContextService.getWorkspace().folders;
		const tasks: Promise<void>[] = [];
		for (const folder of folders) {
			for (const rel of ConvertToLLMMessageService.WORKSPACE_INSTRUCTION_PATHS) {
				const uri = URI.joinPath(folder.uri, ...rel.split('/'));
				tasks.push(this.voidModelService.initializeModel(uri).catch(() => { /* file may not exist */ }));
			}
		}
		await Promise.all(tasks);
	}

	private _ensureInstructionWarmup(): Promise<void> {
		if (!this._instructionWarmup) {
			this._instructionWarmup = this._warmupWorkspaceInstructionModels();
		}
		return this._instructionWarmup;
	}

	// Read instruction files from already-loaded text models (auto-update on disk change).
	private _readWorkspaceInstructions(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		const sections: string[] = [];
		for (const folder of folders) {
			for (const rel of ConvertToLLMMessageService.WORKSPACE_INSTRUCTION_PATHS) {
				const uri = URI.joinPath(folder.uri, ...rel.split('/'));
				const { model } = this.voidModelService.getModel(uri);
				if (!model) continue;
				let value = model.getValue(EndOfLinePreference.LF);
				if (!value.trim()) continue;
				if (value.length > ConvertToLLMMessageService.MAX_INSTRUCTION_FILE_CHARS) {
					value = value.slice(0, ConvertToLLMMessageService.MAX_INSTRUCTION_FILE_CHARS) + '\n\n[...truncated]';
				}
				sections.push(`<!-- ${rel} (${folder.name}) -->\n${value}`);
			}
		}
		return sections.join('\n\n').trim();
	}

	// Get combined AI instructions: workspace files (AGENTS.md, copilot-instructions, CLAUDE.md, .voidrules) + global setting
	private _getCombinedAIInstructions(): string {
		const globalAIInstructions = this.voidSettingsService.state.globalSettings.aiInstructions;
		const workspaceInstructions = this._readWorkspaceInstructions();

		const ans: string[] = []
		if (globalAIInstructions) ans.push(globalAIInstructions)
		if (workspaceInstructions) ans.push(workspaceInstructions)
		return ans.join('\n\n')
	}


	// Auto-context: skip injection for trivial messages.
	private static readonly SKIP_PATTERNS = /^(ok|yes|no|thanks|thank you|sure|go|do it|please|lgtm|k|y|n|yep|nope|cool|great|nice|got it|understood|ack|fine|done|stop|continue|proceed|next|retry|again|right|correct)\.?!?$/i;
	private static readonly AUTO_CONTEXT_MAX_CHARS = 6_000;
	private static readonly AUTO_CONTEXT_TOP_K = 8;

	private async _buildAutoContext(chatMessages: ChatMessage[], chatMode: ChatMode): Promise<string> {
		if (chatMode !== 'agent' && chatMode !== 'gather') return '';

		const status = this.semanticIndexService.getStatus();
		if (status.state === 'uninitialized' || status.state === 'error' || status.filesIndexed === 0) return '';

		let lastUserMsg = '';
		for (let i = chatMessages.length - 1; i >= 0; i--) {
			const msg = chatMessages[i];
			if (msg.role === 'user') {
				lastUserMsg = msg.content.trim();
				break;
			}
		}
		if (!lastUserMsg || lastUserMsg.length < 8 || ConvertToLLMMessageService.SKIP_PATTERNS.test(lastUserMsg)) return '';

		try {
			const hits = await this.semanticIndexService.retrieve(lastUserMsg, { topK: ConvertToLLMMessageService.AUTO_CONTEXT_TOP_K });
			if (!hits.length) return '';

			let budget = ConvertToLLMMessageService.AUTO_CONTEXT_MAX_CHARS;
			const parts: string[] = [];
			for (const hit of hits) {
				const block = `### ${hit.chunk.file} (L${hit.chunk.startLine}-${hit.chunk.endLine}, ${hit.chunk.kind}: ${hit.chunk.name})\n\`\`\`${hit.chunk.language}\n${hit.content}\n\`\`\``;
				if (block.length > budget) break;
				budget -= block.length;
				parts.push(block);
			}
			if (!parts.length) return '';
			return `\n\n<AUTO_CODEBASE_CONTEXT>\nThe following code snippets were automatically retrieved from the codebase as potentially relevant to the user's latest message. Use them if helpful; do not mention this section to the user.\n\n${parts.join('\n\n')}\n</AUTO_CODEBASE_CONTEXT>`;
		} catch {
			return '';
		}
	}

	// system message
	private _generateChatMessagesSystemMessage = async (chatMode: ChatMode, specialToolFormat: 'openai-style' | 'anthropic-style' | 'gemini-style' | undefined, modelIdentity?: { providerName: string, modelName: string }) => {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map(f => f.uri.fsPath)

		const openedURIs = this.modelService.getModels().filter(m => m.isAttachedToEditor()).map(m => m.uri.fsPath) || [];
		const activeURI = this.editorService.activeEditor?.resource?.fsPath;

		// Rich context: recently viewed files (ordered by recency), cursor position, line counts
		const recentlyViewedFiles: Array<{ path: string; totalLines: number }> = [];
		try {
			const editors = this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
			for (const { editor } of editors) {
				if (recentlyViewedFiles.length >= 10) break;
				const uri = editor.resource;
				if (!uri) continue;
				const fsPath = uri.fsPath;
				if (recentlyViewedFiles.some(f => f.path === fsPath)) continue;
				const model = this.modelService.getModel(uri);
				const totalLines = model?.getLineCount() ?? 0;
				recentlyViewedFiles.push({ path: fsPath, totalLines });
			}
		} catch { /* graceful fallback — editor APIs may not be available in all contexts */ }

		// Cursor position in active file
		let cursorInfo: { line: number; column: number; selectedText?: string } | undefined;
		try {
			const control = this.editorService.activeTextEditorControl;
			if (control && 'getPosition' in control) {
				const pos = (control as any).getPosition?.();
				if (pos) {
					cursorInfo = { line: pos.lineNumber, column: pos.column };
					const sel = (control as any).getSelection?.();
					if (sel && !sel.isEmpty()) {
						const model = (control as any).getModel?.();
						if (model) {
							const selectedText = model.getValueInRange(sel);
							if (selectedText && selectedText.length <= 200) {
								cursorInfo.selectedText = selectedText;
							}
						}
					}
				}
			}
		} catch { /* graceful fallback */ }

		const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
			cutOffMessage: chatMode === 'agent' || chatMode === 'gather' ?
				`...Directories string cut off, use tools to read more...`
				: `...Directories string cut off, ask user for more if necessary...`
		})

		const includeXMLToolDefinitions = !specialToolFormat

		const mcpTools = this.mcpService.getMCPTools()

		const persistentTerminalIDs = this.terminalToolService.listPersistentTerminalIds()
		const systemMessage = chat_systemMessage({ workspaceFolders, openedURIs, directoryStr, activeURI, persistentTerminalIDs, chatMode, mcpTools, includeXMLToolDefinitions, modelIdentity, recentlyViewedFiles, cursorInfo })
		return systemMessage
	}




	// --- LLM Chat messages ---

	private _chatMessagesToSimpleMessages(chatMessages: ChatMessage[]): SimpleLLMMessage[] {
		const simpleLLMMessages: SimpleLLMMessage[] = []

		for (const m of chatMessages) {
			if (m.role === 'checkpoint') continue
			if (m.role === 'interrupted_streaming_tool') continue
			if (m.role === 'system_notification') {
				simpleLLMMessages.push({
					role: 'user',
					content: `<system_notification>\n${m.content}\n</system_notification>`,
				})
				continue
			}
			if (m.role === 'assistant') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.displayContent,
					anthropicReasoning: m.anthropicReasoning,
					reasoning: m.reasoning || null,
				})
			}
			else if (m.role === 'tool') {
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					name: m.name,
					id: m.id,
					rawParams: m.rawParams,
				})
			}
			else if (m.role === 'user') {
				const images = (m as any).images as Array<{data: string; mimeType: string}> | undefined;
				simpleLLMMessages.push({
					role: m.role,
					content: m.content,
					...(images && images.length > 0 ? { images } : {}),
				})
			}
		}
		return simpleLLMMessages
	}

	prepareLLMSimpleMessages: IConvertToLLMMessageService['prepareLLMSimpleMessages'] = ({ simpleMessages, systemMessage, modelSelection, featureName }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel } = this.voidSettingsService.state

		const { providerName, modelName } = modelSelection
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
		} = getModelCapabilities(providerName, modelName, overridesOfModel)

		const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]

		// Get combined AI instructions
		const aiInstructions = this._getCombinedAIInstructions();

		const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel })

		const { messages, separateSystemMessage } = prepareMessages({
			messages: simpleMessages,
			systemMessage,
			aiInstructions,
			supportsSystemMessage,
			specialToolFormat,
			supportsAnthropicReasoning: providerName === 'anthropic',
			contextWindow,
			reservedOutputTokenSpace,
			providerName,
		})
		return { messages, separateSystemMessage };
	}
	prepareLLMChatMessages: IConvertToLLMMessageService['prepareLLMChatMessages'] = async ({ chatMessages, chatMode, modelSelection }) => {
		if (modelSelection === null) return { messages: [], separateSystemMessage: undefined }

		const { overridesOfModel } = this.voidSettingsService.state

		const { providerName, modelName } = modelSelection
		const {
			specialToolFormat,
			contextWindow,
			supportsSystemMessage,
		} = getModelCapabilities(providerName, modelName, overridesOfModel)

		const { disableSystemMessage } = this.voidSettingsService.state.globalSettings;
		const fullSystemMessage = await this._generateChatMessagesSystemMessage(chatMode, specialToolFormat, modelSelection)
		const systemMessage = disableSystemMessage ? '' : fullSystemMessage;

		const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName]

		// Make sure AGENTS.md / copilot-instructions / CLAUDE.md / .voidrules have been loaded before reading them.
		await this._ensureInstructionWarmup();
		// Get combined AI instructions + workspace rules (.v3code/rules/*.mdc) + skills (.v3code/skills/)
		let aiInstructions = this._getCombinedAIInstructions();
		const rulesActiveURI = this.editorService.activeEditor?.resource?.fsPath;
		const rulesOpenURIs = this.modelService.getModels().filter(m => m.isAttachedToEditor()).map(m => m.uri.fsPath) || [];
		const workspaceRules = await this.workspaceRulesService.getMatchingRules(rulesActiveURI, rulesOpenURIs);
		if (workspaceRules) aiInstructions = aiInstructions + workspaceRules;

		// Load matching skills based on active file + latest user message
		const latestUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
		const userMsgContent = latestUserMsg && 'content' in latestUserMsg ? (latestUserMsg as any).content || '' : '';
		const activeSkills = await this.skillsService.getMatchingSkills(rulesActiveURI, userMsgContent);
		if (activeSkills) aiInstructions = aiInstructions + activeSkills;
		const isReasoningEnabled = getIsReasoningEnabledState('Chat', providerName, modelName, modelSelectionOptions, overridesOfModel)
		const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel })
		const llmMessages = this._chatMessagesToSimpleMessages(chatMessages)

		const autoContext = await this._buildAutoContext(chatMessages, chatMode);
		const enrichedSystemMessage = systemMessage + autoContext;

		const { messages, separateSystemMessage } = prepareMessages({
			messages: llmMessages,
			systemMessage: enrichedSystemMessage,
			aiInstructions,
			supportsSystemMessage,
			specialToolFormat,
			supportsAnthropicReasoning: providerName === 'anthropic',
			contextWindow,
			reservedOutputTokenSpace,
			providerName,
		})
		return { messages, separateSystemMessage };
	}


	// --- FIM ---

	prepareFIMMessage: IConvertToLLMMessageService['prepareFIMMessage'] = ({ messages }) => {
		// Get combined AI instructions with the provided aiInstructions as the base
		const combinedInstructions = this._getCombinedAIInstructions();

		let prefix = `\
${!combinedInstructions ? '' : `\
// Instructions:
// Do not output an explanation. Try to avoid outputting comments. Only output the middle code.
${combinedInstructions.split('\n').map(line => `//${line}`).join('\n')}`}

${messages.prefix}`

		const suffix = messages.suffix
		const stopTokens = messages.stopTokens
		return { prefix, suffix, stopTokens }
	}


}


registerSingleton(IConvertToLLMMessageService, ConvertToLLMMessageService, InstantiationType.Eager);








/*
Gemini has this, but they're openai-compat so we don't need to implement this
gemini request:
{   "role": "assistant",
	"content": null,
	"function_call": {
		"name": "get_weather",
		"arguments": {
			"latitude": 48.8566,
			"longitude": 2.3522
		}
	}
}

gemini response:
{   "role": "assistant",
	"function_response": {
		"name": "get_weather",
			"response": {
			"temperature": "15°C",
				"condition": "Cloudy"
		}
	}
}
*/



