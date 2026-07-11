# Router Model Matching And Support Flow

Excel Service AI can accept partial router model text from customers.

Examples:

- `TL-WR845N`
- `wr845`
- `archer c6`
- `my router model tl wr845n ver 4`

The app searches the Excel product knowledge list and shows the best matching product. If there are multiple close matches, it shows the top 3 and asks the customer to confirm.

## Problem Detection

The router intelligence layer detects English, Bangla, and Banglish problem words such as:

- `router speed khubi slow`
- `range paina`
- `auto disconnect hoy`
- `lal bati jale`
- `net kaj kore na`

It maps these to support problem names like Slow Internet, No Internet, Auto Disconnect, Range Problem, Red Light / WAN Issue, Router Not Working, Router Hang, No Power, and Configuration Issue.

## Customer Reply Flow

1. Detect product model if the customer wrote a model.
2. Detect router problem words.
3. Show possible causes.
4. Show safe checks first.
5. Ask whether the customer wants guided troubleshooting.
6. Show guided troubleshooting only when the customer asks for it.
7. Firmware process requires exact model and hardware version.
8. If the customer cannot identify model/version or is unsure, recommend Excel CSP.

## Firmware Safety

The app does not provide direct firmware links unless they exist in approved manual data. Wrong firmware or power loss during update may damage the router.

## Sticker Image Future Feature

Sticker image analysis is prepared as a placeholder. Real OCR is not enabled yet. For now, customers should manually write model, hardware version, and SN from the backside sticker.
