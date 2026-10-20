import {
  CognitoUser,
  CognitoUserPool,
  CognitoUserAttribute,
  AuthenticationDetails,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js'
import { getConfig } from './config'

let userPool: CognitoUserPool | null = null

// Created lazily (not at module load) because the pool IDs come from
// config.json, which is only available after loadConfig() has resolved.
function getUserPool(): CognitoUserPool {
  if (!userPool) {
    const { userPoolId, userPoolClientId } = getConfig()
    userPool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: userPoolClientId })
  }
  return userPool
}

/**
 * Registers a new user. Cognito emails them a 6-digit confirmation code —
 * the account can't sign in until confirmSignUp() succeeds with it.
 */
export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [new CognitoUserAttribute({ Name: 'email', Value: email })]
    getUserPool().signUp(email, password, attributes, [], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getUserPool() })
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getUserPool() })
    user.resendConfirmationCode((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Signs in via SRP (Secure Remote Password): the library runs the
 * challenge/response handshake so the password itself is never sent,
 * only proofs derived from it.
 */
export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getUserPool() })
    const authDetails = new AuthenticationDetails({ Username: email, Password: password })
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    })
  })
}

export function signOut(): void {
  getUserPool().getCurrentUser()?.signOut()
}

/**
 * Returns the current session, transparently refreshing the tokens via the
 * stored refresh token if they've expired. Every AWS call goes through here
 * first, since AWS credentials are derived from a valid, current ID token.
 */
export function getCurrentSession(): Promise<CognitoUserSession | null> {
  const user = getUserPool().getCurrentUser()
  if (!user) return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err)
      else resolve(session)
    })
  })
}
