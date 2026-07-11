type StickerImageInput = {
  imageUrl?: string;
  fileName?: string;
};

export function analyzeStickerImagePlaceholder(input: StickerImageInput) {
  void input;

  return {
    status: 'not_enabled' as const,
    message:
      'Sticker image analysis is planned. For now, please write the model, hardware version, and SN from the backside sticker.',
  };
}
