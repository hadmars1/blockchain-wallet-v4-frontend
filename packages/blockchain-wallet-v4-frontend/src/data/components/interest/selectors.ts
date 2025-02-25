import { FiatType, RatesType, RemoteDataType } from '@core/types'
import { selectors } from 'data'
import { RootState } from 'data/rootReducer'

export const getInterestAccountBalance = (state: RootState) =>
  state.components.interest.accountBalance

export const getCoinType = (state: RootState) => state.components.interest.coin

export const getIsAmountDisplayedInCrypto = (state: RootState) =>
  state.components.interest.isAmountDisplayedInCrypto

export const getInterestEligible = (state: RootState) => state.components.interest.interestEligible

export const getInterestInstruments = (state: RootState) => state.components.interest.instruments

export const getInterestLimits = (state: RootState) => state.components.interest.interestLimits

export const getInterestAccount = (state: RootState) => state.components.interest.account

export const getDepositAddress = (state: RootState) => {
  const account = getInterestAccount(state).getOrElse({ accountRef: '' })
  return account.accountRef
}
export const getInterestRate = (state: RootState) => state.components.interest.interestRate

export const getInterestTransactionsReport = (state: RootState) =>
  state.components.interest.transactionsReport

export const getInterestTransactions = (state: RootState) => state.components.interest.transactions

export const getDepositLimits = (state: RootState) => state.components.interest.depositLimits

export const getPayment = (state: RootState) => state.components.interest.payment

export const getRates = (state: RootState): RemoteDataType<string, RatesType> => {
  const coinType = getCoinType(state)

  return selectors.core.data.misc.getRatesSelector(coinType, state)
}

export const getStep = (state: RootState) => state.components.interest.step

export const getTransactionsNextPage = (state: RootState) =>
  state.components.interest.transactionsNextPage

export const getWalletCurrency = (state: RootState): RemoteDataType<string, FiatType> => {
  return selectors.core.settings.getCurrency(state)
}

export const getWithdrawalMinimums = (state: RootState) =>
  state.components.interest.withdrawalMinimums

export const getAfterTransaction = (state: RootState) => state.components.interest.afterTransaction

export const getInterestEDDStatus = (state: RootState) =>
  state.components.interest.interestEDDStatus

export const getInterestEDDWithdrawLimits = (state: RootState) =>
  state.components.interest.interestEDDWithdrawLimits

export const getInterestEDDDepositLimits = (state: RootState) =>
  state.components.interest.interestEDDDepositLimits
