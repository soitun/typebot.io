import React, { useEffect, useState } from 'react'
import { Text, HStack } from '@chakra-ui/react'
import { SearchableDropdown } from '../../../shared/SearchableDropdown'

type FontSelectorProps = {
  activeFont?: string
  onSelectFont: (font: string) => void
}

export const FontSelector = ({
  activeFont,
  onSelectFont,
}: FontSelectorProps) => {
  const [currentFont, setCurrentFont] = useState(activeFont)
  const [googleFonts, setGoogleFonts] = useState<string[]>([])

  useEffect(() => {
    fetchPopularFonts().then(setGoogleFonts)
  }, [])

  const fetchPopularFonts = async () => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_API_KEY) return []
    const response = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}&sort=popularity`
    )
    return (await response.json()).items.map(
      (item: { family: string }) => item.family
    )
  }

  const handleFontSelected = (nextFont: string) => {
    if (nextFont == currentFont) return
    setCurrentFont(nextFont)
    onSelectFont(nextFont)
  }

  return (
    <HStack justify="space-between" align="center">
      <Text>Font</Text>
      <SearchableDropdown
        selectedItem={activeFont}
        items={googleFonts}
        onValueChange={handleFontSelected}
      />
    </HStack>
  )
}
