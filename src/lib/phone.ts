export type Country = {
	code: string
	dialCode: string
	maxDigits: number
	format: (digits: string) => string
}

const usFormat = (digits: string) => {
	if (digits.length <= 3) return digits
	if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
	return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const ukFormat = (digits: string) => {
	if (digits.length <= 4) return digits
	if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
	return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

const defaultFormat = (digits: string) => {
	if (digits.length <= 4) return digits
	if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`
	return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
}

export const countries: Country[] = [
	{ code: 'US', dialCode: '+1', maxDigits: 10, format: usFormat },
	{ code: 'CA', dialCode: '+1', maxDigits: 10, format: usFormat },
	{ code: 'GB', dialCode: '+44', maxDigits: 10, format: ukFormat },
	{ code: 'AU', dialCode: '+61', maxDigits: 9, format: defaultFormat },
	{ code: 'DE', dialCode: '+49', maxDigits: 11, format: defaultFormat },
	{ code: 'FR', dialCode: '+33', maxDigits: 9, format: defaultFormat },
	{ code: 'JP', dialCode: '+81', maxDigits: 10, format: defaultFormat },
	{ code: 'KR', dialCode: '+82', maxDigits: 10, format: defaultFormat },
	{ code: 'CN', dialCode: '+86', maxDigits: 11, format: defaultFormat },
	{ code: 'IN', dialCode: '+91', maxDigits: 10, format: defaultFormat },
	{ code: 'BR', dialCode: '+55', maxDigits: 11, format: defaultFormat },
	{ code: 'MX', dialCode: '+52', maxDigits: 10, format: defaultFormat },
	{ code: 'ES', dialCode: '+34', maxDigits: 9, format: defaultFormat },
	{ code: 'IT', dialCode: '+39', maxDigits: 10, format: defaultFormat },
	{ code: 'NL', dialCode: '+31', maxDigits: 9, format: defaultFormat },
	{ code: 'SG', dialCode: '+65', maxDigits: 8, format: defaultFormat },
	{ code: 'HK', dialCode: '+852', maxDigits: 8, format: defaultFormat },
	{ code: 'NZ', dialCode: '+64', maxDigits: 9, format: defaultFormat },
	{ code: 'IE', dialCode: '+353', maxDigits: 9, format: defaultFormat },
	{ code: 'CH', dialCode: '+41', maxDigits: 9, format: defaultFormat },
]

export function getCountryByCode(code: string): Country | undefined {
	return countries.find((c) => c.code === code)
}

export function getCountryByDialCode(dialCode: string): Country | undefined {
	return countries.find((c) => c.dialCode === dialCode)
}

export function parsePhone(fullNumber: string): {
	country: Country
	national: string
} {
	const digits = fullNumber.replace(/\D/g, '')

	for (const country of countries) {
		const dialDigits = country.dialCode.replace(/\D/g, '')
		if (digits.startsWith(dialDigits)) {
			return {
				country,
				national: digits.slice(dialDigits.length),
			}
		}
	}

	return {
		country: countries[0],
		national: digits,
	}
}

export function formatE164(country: Country, nationalDigits: string): string {
	return `${country.dialCode}${nationalDigits}`
}
