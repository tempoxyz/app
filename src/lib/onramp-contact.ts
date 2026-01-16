import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	getContactInfoFn,
	getOnrampStatusFn,
	sendOtpFn,
	setEmailFn,
	setPhoneFn,
	verifyOtpFn,
} from './server/onramp-contact.server'

export function useOnrampStatus(address: string | undefined) {
	return useQuery({
		queryKey: ['onramp', 'status', address],
		queryFn: () => getOnrampStatusFn(address as string),
		enabled: Boolean(address),
		staleTime: 30 * 1000,
	})
}

export function useContactInfo(address: string | undefined) {
	return useQuery({
		queryKey: ['onramp', 'contact', address],
		queryFn: () => getContactInfoFn(address as string),
		enabled: Boolean(address),
		staleTime: 30 * 1000,
	})
}

export function useSetEmail(address: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (email: string) => setEmailFn(address, email),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['onramp', 'status', address] })
			queryClient.invalidateQueries({
				queryKey: ['onramp', 'contact', address],
			})
		},
	})
}

export function useSetPhone(address: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (phone: string) => setPhoneFn(address, phone),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['onramp', 'status', address] })
			queryClient.invalidateQueries({
				queryKey: ['onramp', 'contact', address],
			})
		},
	})
}

export function useSendOtp(address: string) {
	return useMutation({
		mutationFn: async () => {
			const result = await sendOtpFn(address)
			return result as {
				success: boolean
				expiresAt: string
				testMode?: boolean
			}
		},
	})
}

export function useVerifyOtp(address: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (code: string) => verifyOtpFn(address, code),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['onramp', 'status', address] })
			queryClient.invalidateQueries({
				queryKey: ['onramp', 'contact', address],
			})
		},
	})
}
