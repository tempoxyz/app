'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

export function EmojiPicker({
	onSelect,
	anchorRef,
	onClose,
}: {
	selectedEmoji: string | null
	onSelect: (emoji: string) => void
	anchorRef: React.RefObject<HTMLButtonElement | null>
	onClose: () => void
}) {
	const [position, setPosition] = React.useState({ top: 0, left: 0 })
	const pickerRef = React.useRef<HTMLDivElement>(null)

	React.useLayoutEffect(() => {
		if (anchorRef.current) {
			const rect = anchorRef.current.getBoundingClientRect()
			const viewportWidth = window.innerWidth
			const viewportHeight = window.innerHeight
			const pickerWidth = 352
			const pickerHeight = 435

			let left = rect.left
			if (left + pickerWidth > viewportWidth - 8) {
				left = viewportWidth - pickerWidth - 8
			}
			if (left < 8) left = 8

			let top = rect.bottom + 8
			if (top + pickerHeight > viewportHeight - 8) {
				top = rect.top - pickerHeight - 8
			}

			setPosition({ top, left })
		}
	}, [anchorRef])

	React.useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(e.target as Node) &&
				anchorRef.current &&
				!anchorRef.current.contains(e.target as Node)
			) {
				onClose()
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [anchorRef, onClose])

	return createPortal(
		<div
			ref={pickerRef}
			className="fixed z-[9999]"
			style={{ top: position.top, left: position.left }}
		>
			<Picker
				data={data}
				onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)}
				theme="dark"
				previewPosition="none"
				skinTonePosition="none"
				perLine={9}
				emojiSize={22}
				emojiButtonSize={32}
				maxFrequentRows={2}
			/>
		</div>,
		document.body,
	)
}
