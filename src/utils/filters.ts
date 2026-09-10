import type { FilterPreset } from '../types'

// Each filter's `css` string is applied both to the live <video> preview
// and to the capture <canvas> (via ctx.filter) so what you see is what you get.
export const FILTERS: FilterPreset[] = [
    {
        id: 'classic',
        label: 'Classic',
        css: 'contrast(1.05) saturate(1.05)',
    },
    {
        id: 'noir',
        label: 'Noir',
        css: 'grayscale(1) contrast(1.2) brightness(1.05)',
    },
    {
        id: 'sepia',
        label: 'Sepia',
        css: 'sepia(0.75) contrast(1.05) brightness(1.02) saturate(1.2)',
    },
    {
        id: 'vintage',
        label: 'Vintage',
        css: 'sepia(0.35) saturate(1.3) contrast(0.92) brightness(1.08) hue-rotate(-8deg)',
    },
    {
        id: 'faded',
        label: 'Faded',
        css: 'contrast(0.85) brightness(1.12) saturate(0.7)',
    },
]

export const getFilterById = (id: string): FilterPreset =>
    FILTERS.find((f) => f.id === id) ?? FILTERS[0]
