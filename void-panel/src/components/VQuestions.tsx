import { useState } from 'react'

export type VQuestion = { id: string; prompt: string; options?: string[]; multi?: boolean }

export function VQuestions({
	questions,
	onSubmit,
	onSkip,
}: {
	questions: VQuestion[]
	onSubmit: (answers: Record<string, string | string[]>) => void
	onSkip: () => void
}) {
	const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

	return (
		<div className="vquestions">
			<div className="vquestions-head">┌ questions ┐</div>
			{questions.map(q => (
				<div key={q.id} className="vquestions-block">
					<div className="vquestions-prompt">{q.prompt}</div>
					{(q.options ?? []).map(opt => (
						<label key={opt} className="vquestions-opt">
							<input
								type={q.multi ? 'checkbox' : 'radio'}
								name={q.id}
								checked={q.multi
									? ((answers[q.id] as string[] | undefined) ?? []).includes(opt)
									: answers[q.id] === opt}
								onChange={() => {
									if (q.multi) {
										const prev = ((answers[q.id] as string[] | undefined) ?? [])
										const next = prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
										setAnswers(a => ({ ...a, [q.id]: next }))
									} else {
										setAnswers(a => ({ ...a, [q.id]: opt }))
									}
								}}
							/>
							{opt}
						</label>
					))}
				</div>
			))}
			<div className="vquestions-actions">
				<button type="button" className="choice" onClick={() => onSubmit(answers)}>continue</button>
				<button type="button" className="choice" onClick={onSkip}>skip</button>
			</div>
		</div>
	)
}
