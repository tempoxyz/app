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
		// biome-ignore lint/style/noNonNullAssertion: _
		queryFn: () => getOnrampStatusFn({ data: { address: address! } }),
		enabled: !!address,
		staleTime: 30 * 1000,
	})
}

export function useContactInfo(address: string | undefined) {
	return useQuery({
		queryKey: ['onramp', 'contact', address],
		// biome-ignore lint/style/noNonNullAssertion: _
		queryFn: () => getContactInfoFn({ data: { address: address! } }),
		enabled: !!address,
		staleTime: 30 * 1000,
	})
}

export function useSetEmail(address: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (email: string) => setEmailFn({ data: { address, email } }),
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
		mutationFn: (phone: string) => setPhoneFn({ data: { address, phone } }),
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
		mutationFn: () => sendOtpFn({ data: { address } }),
	})
}

export function useVerifyOtp(address: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (code: string) => verifyOtpFn({ data: { address, code } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['onramp', 'status', address] })
			queryClient.invalidateQueries({
				queryKey: ['onramp', 'contact', address],
			})
		},
	})
}
