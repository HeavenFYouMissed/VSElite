/*--------------------------------------------------------------------------------------
 *  V3Code ChatCore — Professional chat input component
 *  Patterns extracted from Trae source (ekm textarea, ekl/ekc wrappers)
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InputBoxProps {
	value: string;
	placeholder?: string;
	disabled?: boolean;
	maxLength?: number;
	/** Minimum rows to show (default 3) */
	minRows?: number;
	/** Maximum rows before scrolling (default 8) */
	maxRows?: number;
	/** Show expand/collapse toggle to go beyond maxRows */
	zoomUpRows?: number;
	/** Character count display */
	showCharCount?: boolean;
	/** Error message displayed below the textarea */
	errorMessage?: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
	onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InputBox: React.FC<InputBoxProps> = ({
	value,
	placeholder = 'Message V3Code...',
	disabled = false,
	maxLength,
	minRows = 3,
	maxRows = 8,
	zoomUpRows,
	showCharCount = false,
	errorMessage,
	onChange,
	onSubmit,
	onKeyDown,
	onFocus,
	onBlur,
	className = '',
}) => {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [isFocused, setIsFocused] = useState(false);
	const [isZoomed, setIsZoomed] = useState(false);
	const effectiveRows = isZoomed && zoomUpRows ? zoomUpRows : maxRows;

	// Track whether we should use maxRows or zoomUpRows
	const actualMaxRows = isZoomed && zoomUpRows ? zoomUpRows : maxRows;

	const rowHeight = 20; // matches 13px font + line-height 20px
	const minHeight = minRows * rowHeight;
	const maxHeight = actualMaxRows * rowHeight;

	const adjustHeight = useCallback(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = 'auto';
		const scrollHeight = ta.scrollHeight;
		const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
		ta.style.height = `${newHeight}px`;
	}, [minHeight, maxHeight]);

	// Adjust height on value change or zoom toggle
	useEffect(() => {
		adjustHeight();
	}, [value, isZoomed, adjustHeight]);

	// Re-adjust on window resize
	useEffect(() => {
		const onResize = () => adjustHeight();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [adjustHeight]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			let newValue = e.target.value;
			if (maxLength && newValue.length > maxLength) {
				newValue = newValue.slice(0, maxLength);
			}
			onChange(newValue);
			adjustHeight();
		},
		[onChange, maxLength, adjustHeight],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				onSubmit?.();
				return;
			}
			onKeyDown?.(e);
		},
		[onSubmit, onKeyDown],
	);

	const handleFocus = useCallback(
		(e: React.FocusEvent<HTMLTextAreaElement>) => {
			setIsFocused(true);
			onFocus?.(e);
		},
		[onFocus],
	);

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLTextAreaElement>) => {
			setIsFocused(false);
			onBlur?.(e);
		},
		[onBlur],
	);

	const charCount = value.length;
	const isOverMax = maxLength ? charCount > maxLength : false;

	return (
		<div
			className={`v3code-input-container flex w-full flex-col box-border ${className}`}
		>
			{/* Textarea wrapper — Trae ekc pattern: positioned, with border */}
			<div
				className={`
					v3code-input-wrapper
					relative w-full p-1
					border rounded-lg box-border
					transition-colors duration-150
					${isFocused
						? 'border-[var(--vscode-focusBorder,#8B5CF6)] shadow-[0_0_0_2px_rgba(139,92,246,0.15)]'
						: 'border-[var(--vscode-input-border,transparent)]'
					}
					${errorMessage || isOverMax ? '!border-[var(--vscode-inputValidation-errorBorder,#e51400)]' : ''}
					${!disabled ? 'hover:border-[var(--vscode-input-placeholderForeground,rgba(255,255,255,0.2))]' : ''}
					${disabled ? 'opacity-50' : ''}
				`}
			>
				{/* Textarea — Trae eku pattern: transparent, no border, resize:none */}
				<textarea
					ref={textareaRef}
					value={value}
					placeholder={placeholder}
					disabled={disabled}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
					rows={minRows}
					autoComplete="off"
					spellCheck={false}
					className={`
						v3code-textarea
						w-full font-[inherit] text-[13px] leading-[20px]
						resize-none overflow-y-auto box-border
						outline-none border-none bg-transparent
						text-[var(--vscode-input-foreground,#cccccc)]
						placeholder:text-[var(--vscode-input-placeholderForeground,rgba(255,255,255,0.35))]
						px-2
					`}
					style={{
						minHeight: `${minHeight}px`,
						maxHeight: `${maxHeight}px`,
					}}
				/>

				{/* Character count & zoom toggle row — Trae ekd pattern */}
				{(showCharCount || zoomUpRows) && (
					<div className="v3code-input-toolbar flex h-6 items-center justify-end rounded px-1.5 pt-1.5">
						{showCharCount && (
							<span
								className={`
									font-['SF_Pro_Text',inherit] text-xs leading-[18px] tracking-[0.036px]
									overflow-hidden text-ellipsis whitespace-nowrap
									${isOverMax
										? 'text-[var(--vscode-inputValidation-errorForeground,#e51400)]'
										: 'text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]'
									}
								`}
							>
								{charCount}{maxLength ? `/${maxLength}` : ''}
							</span>
						)}
						{zoomUpRows && (
							<button
								type="button"
								onClick={() => {
									setIsZoomed(!isZoomed);
								}}
								className="
									flex h-6 w-6 items-center justify-center rounded
									cursor-pointer ml-1.5
									hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.06))]
									text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.45))]
								"
								title={isZoomed ? 'Collapse' : 'Expand'}
							>
								<span
									className={`codicon text-sm ${isZoomed ? 'codicon-chevron-up' : 'codicon-chevron-down'}`}
								/>
							</button>
						)}
					</div>
				)}
			</div>

			{/* Error message — Trae ekg pattern */}
			{errorMessage && (
				<div className="v3code-input-error flex items-center gap-1 mt-2 text-[var(--vscode-inputValidation-errorForeground,#e51400)] text-[13px] leading-[20px] font-medium">
					<span className="codicon codicon-error text-sm" />
					{errorMessage}
				</div>
			)}
		</div>
	);
};

InputBox.displayName = 'InputBox';
