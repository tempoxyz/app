export type TwilioConfig = {
	accountSid: string
	authToken: string
	fromNumber: string
}

export async function sendSms(
	config: TwilioConfig,
	to: string,
	body: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const { accountSid, authToken, fromNumber } = config

	const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
	const auth = btoa(`${accountSid}:${authToken}`)

	const formData = new URLSearchParams()
	formData.append('To', to)
	formData.append('From', fromNumber)
	formData.append('Body', body)

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData.toString(),
		})

		const data = (await response.json()) as { sid?: string; message?: string }

		if (!response.ok) {
			console.error('[Twilio] Error:', data)
			return { success: false, error: data.message ?? 'Failed to send SMS' }
		}

		console.log('[Twilio] SMS sent:', data.sid)
		return { success: true, messageId: data.sid }
	} catch (error) {
		console.error('[Twilio] Exception:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}
