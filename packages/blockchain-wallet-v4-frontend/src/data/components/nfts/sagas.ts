import { ethers, Signer } from 'ethers'
import moment from 'moment'
import { call, put, select } from 'redux-saga/effects'

import { Remote } from '@core'
import { APIType } from '@core/network/api'
import { NFT_ORDER_PAGE_LIMIT } from '@core/network/api/nfts'
import {
  ExplorerGatewayNftCollectionType,
  GasCalculationOperations,
  GasDataI,
  RawOrder
} from '@core/network/api/nfts/types'
import {
  calculateGasFees,
  cancelNftOrder,
  fulfillNftOrder,
  fulfillNftSellOrder,
  fulfillTransfer,
  getNftBuyOrder,
  getNftMatchingOrders,
  getNftSellOrder
} from '@core/redux/payment/nfts'
import { Await } from '@core/types'
import { errorHandler } from '@core/utils'
import { getPrivateKey } from '@core/utils/eth'
import { actions, selectors } from 'data'
import { ModalName } from 'data/modals/types'
import { promptForSecondPassword } from 'services/sagas'

import * as S from './selectors'
import { actions as A } from './slice'
import { NftOrderStepEnum } from './types'

export const logLocation = 'components/nfts/sagas'
export const WALLET_SIGNER_ERR = 'Error getting eth wallet signer.'
const taskToPromise = (t) => new Promise((resolve, reject) => t.fork(reject, resolve))
const INSUFFICIENT_FUNDS = 'insufficient funds'

export default ({ api }: { api: APIType }) => {
  const IS_TESTNET = api.ethProvider.network?.name === 'rinkeby'

  const clearAndRefetchAssets = function* () {
    yield put(A.resetNftAssets())
    yield put(A.fetchNftAssets())
  }

  const clearAndRefetchOffersMade = function* () {
    yield put(A.resetNftOffersMade())
    yield put(A.fetchNftOffersMade())
  }

  const fetchNftAssets = function* () {
    try {
      const assets = S.getNftAssets(yield select())
      if (assets.atBound) return
      yield put(A.fetchNftAssetsLoading())
      const ethAddrR = selectors.core.kvStore.eth.getDefaultAddress(yield select())
      const ethAddr = ethAddrR.getOrFail('No ETH address.')
      const nfts: ReturnType<typeof api.getNftAssets> = yield call(
        api.getNftAssets,
        ethAddr,
        assets.page
      )

      if (nfts.length < NFT_ORDER_PAGE_LIMIT) {
        yield put(A.setAssetBounds({ atBound: true }))
      } else {
        yield put(A.setAssetData({ page: assets.page + 1 }))
      }

      yield put(A.fetchNftAssetsSuccess(nfts))
    } catch (e) {
      const error = errorHandler(e)
      yield put(A.fetchNftAssetsFailure(error))
    }
  }

  const fetchNftCollection = function* (action: ReturnType<typeof A.fetchNftCollection>) {
    try {
      yield put(A.fetchNftCollectionLoading())
      const { collection }: ReturnType<typeof api.getNftCollection> = yield call(
        api.getNftCollection,
        action.payload.slug
      )
      yield put(A.fetchNftCollectionSuccess(collection))
      yield put(A.resetCollectionFilter())
    } catch (e) {
      const error = errorHandler(e)
      yield put(A.fetchNftCollectionFailure(error))
    }
  }

  const fetchNftCollections = function* (action: ReturnType<typeof A.fetchNftCollections>) {
    try {
      const collections = S.getNftCollections(yield select())
      if (Remote.Success.is(collections) && !action.payload.direction && !action.payload.sortBy)
        return
      yield put(A.fetchNftCollectionsLoading())
      const response: ReturnType<typeof api.getNftCollections> = yield call(
        api.getNftCollections,
        action.payload.sortBy,
        action.payload.direction
      )
      // filter crypto punks, or others
      const exclusionList = ['CryptoPunks']
      const excludeCollections = (collection: ExplorerGatewayNftCollectionType) => {
        return !(exclusionList.indexOf(collection.name) > -1)
      }
      // filter collections w/ no img
      const hasImageUrl = (collection: ExplorerGatewayNftCollectionType) => collection.image_url

      const nfts = response.filter(excludeCollections).filter(hasImageUrl)
      yield put(A.fetchNftCollectionsSuccess(nfts))
    } catch (e) {
      const error = errorHandler(e)
      yield put(A.fetchNftCollectionsFailure(error))
    }
  }

  const fetchNftOffersMade = function* () {
    try {
      const offers = S.getOffersMade(yield select())
      if (offers.atBound) return
      yield put(A.fetchNftOffersMadeLoading())
      const ethAddrR = selectors.core.kvStore.eth.getDefaultAddress(yield select())
      const ethAddr = ethAddrR.getOrFail('No ETH address.')
      const { asset_events }: ReturnType<typeof api.getOffersMade> = yield call(
        api.getOffersMade,
        ethAddr,
        offers.page
      )

      if (asset_events.length < NFT_ORDER_PAGE_LIMIT) {
        yield put(A.setOffersMadeBounds({ atBound: true }))
      } else {
        yield put(A.setOffersMadeData({ page: offers.page + 1 }))
      }

      yield put(A.fetchNftOffersMadeSuccess(asset_events))
    } catch (e) {
      const error = errorHandler(e)
      yield put(A.fetchNftOffersMadeFailure(error))
    }
  }

  const fetchOpenseaAsset = function* (action: ReturnType<typeof A.fetchOpenseaAsset>) {
    try {
      yield put(A.fetchOpenseaAssetLoading())
      const res: ReturnType<typeof api.getOpenSeaAsset> = yield call(
        api.getOpenSeaAsset,
        action.payload.address,
        action.payload.token_id
      )
      yield put(A.fetchOpenseaAssetSuccess(res))
    } catch (e) {
      yield put(A.fetchOpenseaAssetFailure(e))
    }
  }
  const fetchOpenseaStatus = function* () {
    try {
      yield put(A.fetchNftOffersMadeLoading())
      const res: ReturnType<typeof api.getOpenSeaStatus> = yield call(api.getOpenSeaStatus)
      yield put(A.fetchOpenseaStatusSuccess(res))
    } catch (e) {
      yield put(A.fetchOpenseaStatusFailure(e))
    }
  }

  const getEthSigner = function* () {
    try {
      const password = yield call(promptForSecondPassword)
      const getMnemonic = (state) => selectors.core.wallet.getMnemonic(state, password)
      const mnemonicT = yield select(getMnemonic)
      const mnemonic = yield call(() => taskToPromise(mnemonicT))
      const privateKey = getPrivateKey(mnemonic)
      const wallet = new ethers.Wallet(privateKey, api.ethProvider)
      return wallet
    } catch (e) {
      throw new Error(WALLET_SIGNER_ERR)
    }
  }

  // This is a very important function. Not only is it used to fetch fees
  // it is also used to create matching orders for the order/offer passed in
  // and then those matching orders are put on state.
  const fetchFees = function* (action: ReturnType<typeof A.fetchFees>) {
    try {
      yield put(A.fetchFeesLoading())
      const signer: Signer = yield call(getEthSigner)
      let fees

      if (action.payload.operation === GasCalculationOperations.Buy) {
        yield put(A.fetchMatchingOrderLoading())
        try {
          const { buy, sell }: Await<ReturnType<typeof getNftMatchingOrders>> = yield call(
            getNftMatchingOrders,
            action.payload.order,
            signer,
            undefined,
            IS_TESTNET ? 'rinkeby' : 'mainnet',
            action.payload.paymentTokenAddress
          )
          fees = yield call(
            calculateGasFees,
            GasCalculationOperations.Buy,
            signer,
            undefined,
            buy,
            sell
          )
          yield put(A.fetchMatchingOrderSuccess({ buy, sell }))
        } catch (e) {
          const error = errorHandler(e)
          yield put(A.fetchMatchingOrderFailure(error))
          throw e
        }
      } else if (action.payload.operation === GasCalculationOperations.CreateOffer) {
        const buy: Await<ReturnType<typeof getNftBuyOrder>> = yield call(
          getNftBuyOrder,
          action.payload.asset,
          signer,
          undefined,
          Number(action.payload.offer),
          action.payload.paymentTokenAddress,
          IS_TESTNET ? 'rinkeby' : 'mainnet'
        )

        fees = yield call(
          calculateGasFees,
          GasCalculationOperations.CreateOffer,
          signer,
          undefined,
          buy
        )
      } else if (action.payload.operation === GasCalculationOperations.AcceptOffer) {
        const { order } = action.payload
        yield put(A.fetchMatchingOrderLoading())
        try {
          const { buy, sell }: Await<ReturnType<typeof getNftMatchingOrders>> = yield call(
            getNftMatchingOrders,
            order,
            signer,
            undefined,
            IS_TESTNET ? 'rinkeby' : 'mainnet'
          )
          fees = yield call(
            calculateGasFees,
            GasCalculationOperations.Buy,
            signer,
            undefined,
            buy,
            sell
          )
          yield put(A.fetchMatchingOrderSuccess({ buy, sell }))
        } catch (e) {
          const error = errorHandler(e)
          yield put(A.fetchMatchingOrderFailure(error))
          throw e
        }
      } else if (action.payload.operation === GasCalculationOperations.Cancel) {
        fees = yield call(
          calculateGasFees,
          GasCalculationOperations.Cancel,
          signer,
          action.payload.order as RawOrder
        )
      } else if (action.payload.operation === GasCalculationOperations.Sell) {
        const listingTime = action.payload.listingTime
          ? new Date(action.payload.listingTime).getTime() / 1000 > new Date().getTime() / 1000
            ? new Date(action.payload.listingTime).getTime() / 1000
            : moment().add(10, 'minutes').unix()
          : undefined
        const expirationTime =
          action.payload.expirationTime !== '' && action.payload.expirationTime !== undefined
            ? new Date(action.payload.expirationTime).getTime() / 1000
            : moment().add(7, 'day').unix()
        const order: Await<ReturnType<typeof getNftSellOrder>> = yield call(
          getNftSellOrder,
          action.payload.asset,
          signer,
          listingTime,
          expirationTime,
          action.payload.startPrice,
          action.payload.endPrice,
          IS_TESTNET ? 'rinkeby' : 'mainnet',
          action.payload.waitForHighestBid,
          action.payload.paymentTokenAddress
        )
        fees = yield call(
          calculateGasFees,
          GasCalculationOperations.Sell,
          signer,
          undefined,
          undefined,
          order
        )
      } else if (action.payload.operation === GasCalculationOperations.Transfer) {
        fees = yield call(
          calculateGasFees,
          GasCalculationOperations.Transfer,
          signer,
          undefined,
          undefined,
          undefined,
          action.payload.asset,
          action.payload.to
        )
      }

      yield put(A.fetchFeesSuccess(fees as GasDataI))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e)
      const error = errorHandler(e)
      yield put(A.fetchFeesFailure(error))
    }
  }

  const acceptOffer = function* (action: ReturnType<typeof A.acceptOffer>) {
    try {
      yield put(A.setOrderFlowIsSubmitting(true))
      const signer: Signer = yield call(getEthSigner)
      const { buy, gasData, sell } = action.payload
      yield call(fulfillNftOrder, { buy, gasData, sell, signer })
      yield put(actions.modals.closeAllModals())
      yield put(A.clearAndRefetchAssets())
      yield put(actions.alerts.displaySuccess(`Successfully accepted offer!`))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to accept this offer.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const createOffer = function* (action: ReturnType<typeof A.createOffer>) {
    try {
      yield put(A.setOrderFlowIsSubmitting(true))
      const signer = yield call(getEthSigner)
      if (!action.payload.coin) throw new Error('No coin selected for offer.')
      const { coinfig } = window.coins[action.payload.coin]
      if (!coinfig.type.erc20Address) throw new Error('Offers must use an ERC-20 token.')
      // TODO: DONT DEFAULT TO 1 WEEK
      const expirationTime = moment().add(7, 'day').unix()
      const buy: Await<ReturnType<typeof getNftBuyOrder>> = yield call(
        getNftBuyOrder,
        action.payload.asset,
        signer,
        expirationTime,
        Number(action.payload.amount || '0'),
        coinfig.type.erc20Address,
        IS_TESTNET ? 'rinkeby' : 'mainnet'
      )
      const gasData: GasDataI = yield call(
        calculateGasFees,
        GasCalculationOperations.CreateOffer,
        signer,
        undefined,
        buy
      )
      const order = yield call(fulfillNftOrder, { buy, gasData, signer })
      yield call(api.postNftOrder, order)
      yield put(actions.modals.closeAllModals())
      yield put(A.clearAndRefetchOffersMade())
      yield put(A.clearAndRefetchOrders())
      yield put(actions.router.push('/nfts/activity'))
      yield put(actions.alerts.displaySuccess(`Successfully created offer!`))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to create this offer.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const createOrder = function* (action: ReturnType<typeof A.createOrder>) {
    try {
      yield put(A.setOrderFlowIsSubmitting(true))
      const { buy, gasData, sell } = action.payload
      const signer = yield call(getEthSigner)
      yield call(fulfillNftOrder, { buy, gasData, sell, signer })
      yield put(actions.modals.closeAllModals())
      yield put(actions.router.push('/nfts/collection'))
      yield put(
        actions.alerts.displaySuccess(
          `Successfully created order! It may take a few minutes to appear in your collection.`
        )
      )
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to create this order.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const createSellOrder = function* (action: ReturnType<typeof A.createSellOrder>) {
    try {
      const listingTime = action.payload.listingTime
        ? new Date(action.payload.listingTime).getTime() / 1000 > new Date().getTime() / 1000
          ? new Date(action.payload.listingTime).getTime() / 1000
          : moment().add(10, 'minutes').unix()
        : undefined
      const expirationTime =
        action.payload.expirationTime !== '' && action.payload.expirationTime !== undefined
          ? new Date(action.payload.expirationTime).getTime() / 1000
          : moment().add(7, 'day').unix()
      yield put(A.setOrderFlowIsSubmitting(true))
      const signer = yield call(getEthSigner)
      const signedOrder: Await<ReturnType<typeof getNftSellOrder>> = yield call(
        getNftSellOrder,
        action.payload.asset,
        signer,
        listingTime,
        expirationTime,
        action.payload.startPrice,
        action.payload.endPrice,
        IS_TESTNET ? 'rinkeby' : 'mainnet',
        action.payload.waitForHighestBid,
        action.payload.paymentTokenAddress
      )
      const order = yield call(fulfillNftSellOrder, signedOrder, signer, action.payload.gasData)
      yield call(api.postNftOrder, order)
      yield put(A.clearAndRefetchAssets())
      yield put(actions.modals.closeAllModals())
      yield put(actions.alerts.displaySuccess('Sell order created!'))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to sell this asset.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const createTransfer = function* (action: ReturnType<typeof A.createTransfer>) {
    try {
      yield put(A.setOrderFlowIsSubmitting(true))
      const signer = yield call(getEthSigner)
      const order = yield call(fulfillTransfer, action.payload.asset, signer, action.payload.to, {
        gasLimit: action.payload.gasData.gasFees.toString(),
        gasPrice: action.payload.gasData.gasPrice.toString()
      })
      yield call(api.postNftOrder, order)
      yield put(A.clearAndRefetchAssets())
      yield put(actions.modals.closeAllModals())
      yield put(actions.alerts.displaySuccess('Transfer successful!'))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to transfer this asset.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const cancelListing = function* (action: ReturnType<typeof A.cancelListing>) {
    try {
      const signer = yield call(getEthSigner)
      yield put(A.setOrderFlowIsSubmitting(true))
      yield call(cancelNftOrder, action.payload.order, signer, action.payload.gasData)
      yield put(A.clearAndRefetchAssets())
      yield put(actions.modals.closeAllModals())
      yield put(actions.alerts.displaySuccess(`Successfully cancelled listing!`))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to cancel this listing.'
      yield put(actions.logs.logErrorMessage(error))
      yield put(actions.alerts.displayError(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  // https://etherscan.io/tx/0x4ba256c46b0aff8b9ee4cc2a7d44649bc31f88ebafd99190bc182178c418c64a
  const cancelOffer = function* (action: ReturnType<typeof A.cancelOffer>) {
    try {
      if (!action.payload.order) {
        throw new Error('No offer found. It may have expired already!')
      }
      const signer = yield call(getEthSigner)
      yield put(A.setOrderFlowIsSubmitting(true))
      yield call(cancelNftOrder, action.payload.order, signer, action.payload.gasData)
      yield put(A.clearAndRefetchOffersMade())
      yield put(actions.modals.closeAllModals())
      yield put(actions.alerts.displaySuccess(`Successfully cancelled offer!`))
    } catch (e) {
      let error = errorHandler(e)
      if (error.includes(INSUFFICIENT_FUNDS))
        error = 'You do not have enough funds to cancel this offer.'
      yield put(actions.alerts.displayError(error))
      yield put(actions.logs.logErrorMessage(error))
    }

    yield put(A.setOrderFlowIsSubmitting(false))
  }

  const formChanged = function* (action) {
    if (action.meta.form === 'nftSearch') {
      if (action.meta.field === 'sortBy') {
        yield put(
          A.fetchNftCollections({
            direction: action.payload.split('-')[1] as 'ASC' | 'DESC',
            sortBy: action.payload.split('-')[0] as keyof ExplorerGatewayNftCollectionType
          })
        )
      }
    }
    if (action.meta.form === 'nftCollection') {
      if (action.meta.field === 'collection') {
        yield put(A.setAssetData({ collection: action.payload }))
      }
    }
  }

  // DEPRECATED 👇👇👇👇👇👇👇👇👇👇👇👇👇
  // When you open the order flow you can open directly to the following operations:
  // 1: Buy
  // 2: Sell
  // 3: Cancel Offer (Made by user)
  // Other operations are opened from within the flow itself, so you WILL NOT find
  // find those in this function. Those include:
  // 1: Transfer
  // 2: Accept Offer
  // 3: Cancel Listing
  // DEPRECATED 👆👆👆👆👆👆👆👆👆👆👆👆👆

  // explorer-gateway v2
  // With the introduction of the explorer-gateway graphql API the flow will need to change a bit
  // For one, we will not have orders until the user has selected an asset. So the new flow will
  // be: asset => fetch orders => display orders
  const nftOrderFlowOpen = function* (action: ReturnType<typeof A.nftOrderFlowOpen>) {
    yield put(actions.modals.showModal(ModalName.NFT_ORDER, { origin: 'Unknown' }))
    let address = action.payload.asset_contract_address
    let { token_id } = action.payload
    const ethAddr = selectors.core.kvStore.eth.getDefaultAddress(yield select()).getOrElse('')
    // User wants to view an asset, its active listings, or its offers
    if (action.payload.asset) {
      address = action.payload.asset.asset_contract.address
      token_id = action.payload.asset.token_id
    }

    if (action.payload.offer) {
      // User wants to cancel offer
      if (action.payload.offer.from_account.address.toLowerCase() === ethAddr.toLowerCase()) {
        const activeOrders = yield call(
          api.getNftOrders,
          undefined,
          action.payload.offer.asset.asset_contract.address,
          action.payload.offer.asset.token_id,
          action.payload.offer.payment_token.address,
          0,
          ethAddr
        )
        const nonPrefixedEthAddr = ethAddr.replace(/^0x/, '').toLowerCase()
        const offer = activeOrders.orders.find((order) =>
          order.calldata.toLowerCase().includes(nonPrefixedEthAddr)
        )
        yield put(A.setOfferToCancel({ offer }))
        yield put(A.setOrderFlowStep({ step: NftOrderStepEnum.CANCEL_OFFER }))
      }
    }

    if (!address || !token_id) throw new Error('No asset found')

    try {
      yield put(actions.components.nfts.fetchNftOrderAssetLoading())
      const asset: ReturnType<typeof api.getNftAsset> = yield call(
        api.getNftAsset,
        address,
        token_id
      )
      yield put(actions.components.nfts.fetchNftOrderAssetSuccess(asset))
    } catch (e) {
      const error = errorHandler(e)
      yield put(actions.components.nfts.fetchNftOrderAssetFailure(error))
    }
  }

  const nftOrderFlowClose = function* () {
    yield put(actions.modals.closeAllModals())
  }

  const searchNftAssetContract = function* (action: ReturnType<typeof A.searchNftAssetContract>) {
    try {
      if (action.payload.search) {
        const res: ReturnType<typeof api.searchNftCollectionInfo> = yield call(
          api.searchNftCollectionInfo,
          action.payload.search
        )
        yield put(A.setCollectionSearch(res))
      } else if (action.payload.asset_contract_address) {
        if (ethers.utils.isAddress(action.payload.asset_contract_address)) {
          const res = yield call(api.getAssetContract, action.payload.asset_contract_address)
          yield put(actions.form.change('nftMarketplace', 'collection', res.collection.slug))
        }
      }
    } catch (e) {
      const error = errorHandler(e)
      yield put(actions.form.stopSubmit('nftSearch'))
      yield put(actions.alerts.displayError('Sorry! We had an issue searching that collection.'))
      actions.form.setSubmitFailed('nftSearch', error)
    }
  }

  return {
    acceptOffer,
    cancelListing,
    cancelOffer,
    clearAndRefetchAssets,
    clearAndRefetchOffersMade,
    createOffer,
    createOrder,
    createSellOrder,
    createTransfer,
    fetchFees,
    fetchNftAssets,
    fetchNftCollection,
    fetchNftCollections,
    fetchNftOffersMade,
    fetchOpenseaAsset,
    fetchOpenseaStatus,
    formChanged,
    nftOrderFlowClose,
    nftOrderFlowOpen,
    searchNftAssetContract
  }
}
