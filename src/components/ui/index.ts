/** UI primitives — the design-system surface for Movestock.
 *
 *  Convention: every page MUST assemble its layout from these primitives.
 *  Hand-written `bg-brand text-white rounded-full ...` or `bg-amber-50
 *  border-amber-200 ...` is a smell — reach for <Button>, <Callout>, etc.
 *  instead. New visual patterns should land HERE first, then propagate to
 *  pages. This is the single line that stops drift after launch.
 */

export { Button, LinkButton } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Card, LinkCard } from './Card'
export type { CardProps, CardPadding } from './Card'

export { PageHeader } from './PageHeader'

export { FormField, Input, Textarea, Select } from './FormField'
export type { InputProps, TextareaProps, SelectProps } from './FormField'

export { Callout } from './Callout'
export type { CalloutTone } from './Callout'

export { Badge } from './Badge'
export type { BadgeTone } from './Badge'

export { EmptyState } from './EmptyState'

export { SectionHeader } from './SectionHeader'

export { cx } from './cx'
