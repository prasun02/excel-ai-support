# Router Support AI Flow

Excel Service AI handles router cases with a professional support flow:

1. Customer writes a problem, such as slow speed, range problem, auto disconnect, or no internet.
2. The system detects Router / Internet category and the likely problem from English, Bangla, or Banglish words.
3. If the approved case needs model/version, the bot asks for router model or a clear backside sticker photo. SN is saved if given, but router troubleshooting is not blocked by missing SN.
4. The system uses approved manual support cases first.
5. The bot explains possible causes without claiming final diagnosis.
6. The bot gives safe customer checks first, such as adapter, ONU, restart, nearby test, and connected user checks.
7. For firmware or configuration procedures, the bot warns that the exact model and hardware version must match.
8. If the customer asks for approved step-by-step guidance, the bot can show approved procedure steps.
9. If the customer cannot identify model/version, cannot open the router page, is unsure, or the issue continues, the bot escalates to Excel CSP/human support.

Firmware warning used by the system:

`Firmware update must match exact model and hardware version. Wrong firmware or power loss during update may damage router. If you are unsure, please visit Excel CSP.`

Router IP guidance:

- TP-Link routers usually use `192.168.0.1`.
- Mercusys routers usually use `192.168.1.1`.
- IP may vary by configuration. If it does not open, check default gateway.

Mobile/PC guidance:

Some router pages can open by mobile using default WiFi/SSID from sticker, but firmware update is safer by PC.
