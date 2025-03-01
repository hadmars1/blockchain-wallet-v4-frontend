import React, { useCallback, useRef, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { NavLink } from 'react-router-dom'
import { colors, Icon, IconName, Text } from '@blockchain-com/constellation'
import styled from 'styled-components'

import { Button, Image } from 'blockchain-info-components'
import FabButton from 'components/FabButton'
import { DropdownMenu, DropdownMenuArrow, DropdownMenuItem } from 'components/Navbar/NavbarDropdown'
import { MobileNav } from 'components/NavbarV2'
import { Destination } from 'layouts/Wallet/components'
import { useOnClickOutside } from 'services/misc'
import { useMedia } from 'services/styles'

import MobileDropdown from './MobileDropdown'

export type PrimaryNavItem = {
  dest: string
  e2e: string
  text: string | React.ReactNode
}

const NavContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  background-color: ${colors.white1};
  display: flex;
  justify-content: space-between;
  padding: 0 22px;
  border-bottom: 1px solid ${colors.grey100};
  height: 56px;
`

const Logo = styled.div`
  display: flex;
  align-items: center;

  & > a {
    height: 20px;
    width: 20px;
    color: ${colors.blue500};
    text-decoration: none;
  }
`

const NavLeft = styled.div`
  display: flex;
  align-items: stretch;
`

const NavRight = styled.div`
  display: flex;
  align-items: stretch;
`

const DropdownNavLink = styled(NavLink)`
  padding: 0 !important;
`

const ListStyles = styled.ul`
  list-style: none;
  display: flex;
  align-items: stretch;
  margin: 0;
  padding: 0 0 0 24px;

  & > li {
    display: flex;
    align-items: center;
    padding: 10px 12px;

    &:last-child {
      padding-right: 0;
    }

    &.refresh {
      transition-duration: 0.5s;
    }

    &.refresh:active {
      transform: rotate(360deg);
    }
  }

  & a {
    text-decoration: none;
    color: ${colors.grey600};
    border-radius: 4px;
    padding: 10px;
    transition: background-color 0.3s, color 0.3s;

    &:hover,
    &.active {
      background-color: ${colors.blue0};
      color: ${colors.blue600};
    }
  }
`

const PrimaryNavItems = styled(ListStyles)`
  cursor: pointer;

  & > li {
    padding: 10px 8px;

    & > a > span {
      font-weight: 600;
    }
  }
`

const SecondaryNavItems = styled(ListStyles)`
  cursor: pointer;
`

const NavButton = styled(Button)`
  display: flex;
  align-items: center;
  position: relative;
  transition: color 0.3s;
  background: transparent;
  min-width: auto;
  width: auto;
  padding: 0;
  border: 0;

  &:hover {
    background-color: transparent;
  }
`

const Navbar = ({
  fabClickHandler,
  limitsClickHandler,
  logoutClickHandler,
  primaryNavItems,
  refreshClickHandler
}: Props) => {
  const ref = useRef(null)
  const [isMenuOpen, toggleIsMenuOpen] = useState(false)
  useOnClickOutside(ref, () => toggleIsMenuOpen(false))
  const [isMobileNavOpen, setMobileNav] = useState(false)
  const isMobile = useMedia('mobile')

  const handleMenuToggle = () => {
    toggleIsMenuOpen((isMenuOpen) => !isMenuOpen)
  }

  const closeMobileNavCallback = useCallback(() => {
    setMobileNav(false)
  }, [])
  const openMobileNavCallback = useCallback(() => {
    setMobileNav(true)
  }, [])

  const tertiaryNavItems = [
    {
      copy: <FormattedMessage id='navbar.settings.general' defaultMessage='General' />,
      'data-e2e': 'settings_generalLink',
      to: '/settings/general'
    },
    {
      copy: <FormattedMessage id='buttons.security' defaultMessage='Security' />,
      'data-e2e': 'securityCenterLink',
      to: '/security-center'
    },
    {
      clickHandler: limitsClickHandler,
      copy: (
        <FormattedMessage
          id='layouts.wallet.header.tradinglimits'
          defaultMessage='Trading Limits'
        />
      ),
      'data-e2e': 'settings_profileLink'
    },
    {
      copy: (
        <FormattedMessage id='layouts.wallet.header.preferences' defaultMessage='Preferences' />
      ),
      'data-e2e': 'settings_preferencesLink',
      to: '/settings/preferences'
    },
    {
      copy: (
        <FormattedMessage
          id='layouts.wallet.header.walletsaddresses'
          defaultMessage='Wallets & Addresses'
        />
      ),
      'data-e2e': 'settings_walletsLink',
      to: '/settings/addresses'
    },
    {
      clickHandler: logoutClickHandler,
      copy: <FormattedMessage id='layouts.wallet.header.Sign Out' defaultMessage='Sign Out' />,
      'data-e2e': 'logoutLink'
    }
  ]

  const secondaryNavItems = [
    {
      clickHandler: fabClickHandler,
      component: () => <FabButton onClick={fabClickHandler} />,
      name: 'Trade'
    },
    {
      component: () => <MobileDropdown />,
      name: 'mobile-app'
    },
    {
      component: () => (
        <NavButton onClick={refreshClickHandler} data-e2e='refreshLink'>
          <Icon color={colors.grey400} name={IconName.REFRESH} size='sm' />
        </NavButton>
      ),
      name: 'Refresh'
    },
    {
      component: () => (
        <NavButton onClick={handleMenuToggle} data-e2e='settingsLink'>
          <Icon color={colors.grey400} name={IconName.USER} size='sm' />
          {isMenuOpen && (
            <DropdownMenu ref={ref}>
              <DropdownMenuArrow />
              {tertiaryNavItems.map(({ clickHandler, copy, 'data-e2e': e2e, to }) => {
                if (clickHandler) {
                  return (
                    <DropdownMenuItem key={to} onClick={clickHandler} data-e2e={e2e}>
                      <Destination>{copy}</Destination>
                    </DropdownMenuItem>
                  )
                }
                return (
                  <DropdownNavLink key={to} to={to}>
                    <DropdownMenuItem data-e2e={e2e}>
                      <Destination>{copy}</Destination>
                    </DropdownMenuItem>
                  </DropdownNavLink>
                )
              })}
            </DropdownMenu>
          )}
        </NavButton>
      ),
      name: 'Settings'
    }
  ]
  const secondaryMobileNavItems = secondaryNavItems.filter(
    ({ name }) => name !== 'Mobile App' && name !== 'Refresh' && name !== 'Settings'
  )

  return (
    <NavContainer>
      {isMobileNavOpen && (
        <MobileNav
          handleClose={closeMobileNavCallback}
          primaryNavItems={primaryNavItems}
          secondaryNavItems={secondaryMobileNavItems}
          tertiaryNavItems={tertiaryNavItems}
        />
      )}
      <NavLeft>
        <Logo>
          <NavLink to='/home' data-e2e='homeLink'>
            <Image width='25px' name='blockchain-icon' />
          </NavLink>
        </Logo>
        {!isMobile && (
          <PrimaryNavItems>
            {primaryNavItems.map((item: PrimaryNavItem) => (
              <li key={item.e2e}>
                <NavLink to={item.dest} data-e2e={item.e2e}>
                  <Text variant='paragraph-1'>{item.text}</Text>
                </NavLink>
              </li>
            ))}
          </PrimaryNavItems>
        )}
      </NavLeft>
      <NavRight>
        <SecondaryNavItems>
          {isMobile ? (
            <>
              <li>
                <FabButton onClick={fabClickHandler} />
              </li>
              <li>
                <NavButton onClick={openMobileNavCallback} data-e2e='mobileNavExpand'>
                  <Icon name={IconName.MENU} color={colors.blue500} size='md' />
                </NavButton>
              </li>
            </>
          ) : (
            <>
              {secondaryNavItems.map((item) => (
                <li key={item.name} className={item.name === 'Refresh' ? 'refresh' : ''}>
                  {item.component()}
                </li>
              ))}
            </>
          )}
        </SecondaryNavItems>
      </NavRight>
    </NavContainer>
  )
}

type Props = {
  fabClickHandler: () => void
  limitsClickHandler: () => void
  logoutClickHandler: () => void
  primaryNavItems: Array<PrimaryNavItem>
  refreshClickHandler: () => void
}

export default Navbar
