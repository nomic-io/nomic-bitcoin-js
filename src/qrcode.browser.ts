import QRCodeStyling from 'qr-code-styling';

export function create(style: any = {}) {
  return new (QRCodeStyling as any)(style)
}