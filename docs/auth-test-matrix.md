# BRAG Authentication & Authorization Test Matrix (Phase 2)

Comprehensive test matrix covering all authentication, session hydration, user profile provisioning, authorization, and protected chat requirements for BRAG (Better RAG).

---

## 1. EMAIL AUTHENTICATION

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 1 | New signup | Fresh email & strong password | `POST /api/auth/sign-up/email` with name, email, password | 200 OK, User record created, Session created, Set-Cookie header issued | 200 OK, User & session created | **PASS** | Auto-provisions BRAG profile & preferences |
| 2 | Duplicate signup | Existing email in database | `POST /api/auth/sign-up/email` with existing email | 400/409 Conflict/Error, existing user unaffected | 400 Bad Request / User already exists | **PASS** | Neon unique constraint on email |
| 3 | Valid login | Registered email user | `POST /api/auth/sign-in/email` with valid credentials | 200 OK, Session created, Set-Cookie issued, user payload returned | 200 OK, Session token set in cookie | **PASS** | Authenticated session active |
| 4 | Invalid password | Registered email user | `POST /api/auth/sign-in/email` with wrong password | 401/400 Invalid credentials, no session created | 400/401 Invalid credentials | **PASS** | Better Auth password comparison |
| 5 | Nonexistent account | Unregistered email | `POST /api/auth/sign-in/email` with unregistered email | 401/400 User not found, no session created | 400/401 User not found | **PASS** | Clean error response |
| 6 | Logout | Authenticated email session | `POST /api/auth/sign-out` with session cookie | 200 OK, session revoked on server, session cookie cleared | 200 OK, session deleted from database | **PASS** | Server-side session invalidation |
| 7 | Refresh after login | Authenticated email session | Browser page refresh (`F5`) | Frontend calls `GET /api/auth/get-session`, returns authenticated user, navbar displays user profile | 200 OK, user profile hydrated, navbar shows user state | **PASS** | Zero token storage in localStorage |
| 8 | Session expiry behavior | Session with `expiresAt < NOW()` | Protected API request with expired cookie/bearer | 401 Unauthorized (`UNAUTHORIZED`) | 401 Unauthorized | **PASS** | Verified in automated suite Test 4 |

---

## 2. GOOGLE OAUTH

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 9 | First Google login | Unlinked Google account | Initiate OAuth via `/api/auth/sign-in/social`, authorize on Google consent screen | Redirected to BRAG with session cookie, Better Auth creates user + account, BRAG provisions profile & preferences | 200 / Redirect to frontend with authenticated session | **PASS** | Same-origin Vercel proxy handles state & cookies |
| 10 | Existing Google login | Existing linked Google user | Initiate OAuth via Google | Redirects back with new active session, fetches existing BRAG profile idempotently | 200 / Redirect with session | **PASS** | No duplicate profile created |
| 11 | Google login after logout | Previously logged out Google user | Re-authenticate via Google OAuth | Fresh session created, navbar immediately transitions to Authenticated | 200 / New session active | **PASS** | Full re-authentication flow |
| 12 | Refresh after Google login | Authenticated Google session | Hard refresh / new tab | `GET /api/auth/get-session` returns Google user details, UI retains authenticated state | 200 OK, authenticated session intact | **PASS** | Cookie-based session validation |

---

## 3. GITHUB OAUTH

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 13 | First GitHub login | Unlinked GitHub account | Initiate OAuth via `/api/auth/sign-in/social`, authorize on GitHub consent screen | Redirected to BRAG with session cookie, Better Auth creates user + account, BRAG provisions profile & preferences | 200 / Redirect to frontend with authenticated session | **PASS** | Same-origin Vercel proxy handles state & cookies |
| 14 | Existing GitHub login | Existing linked GitHub user | Initiate OAuth via GitHub | Redirects back with new active session, fetches existing BRAG profile idempotently | 200 / Redirect with session | **PASS** | No duplicate profile created |
| 15 | GitHub login after logout | Previously logged out GitHub user | Re-authenticate via GitHub OAuth | Fresh session created, navbar immediately transitions to Authenticated | 200 / New session active | **PASS** | Full re-authentication flow |
| 16 | Refresh after GitHub login | Authenticated GitHub session | Hard refresh / new tab | `GET /api/auth/get-session` returns GitHub user details, UI retains authenticated state | 200 OK, authenticated session intact | **PASS** | Cookie-based session validation |

---

## 4. SESSION HYDRATION

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 17 | Initial loading state | Fresh application load | Mount `App.jsx` with `AuthProvider` | `isLoading: true`, UI renders skeleton/stable state without flashing "Log In" or claiming unauthenticated | `isLoading: true` rendered cleanly until session resolves | **PASS** | Navbar preserves stable layout |
| 18 | `get-session` authenticated | Valid session cookie in browser | `GET /api/auth/get-session` | 200 OK with `{ user: {...}, session: {...} }`, `isAuthenticated: true` | 200 OK, user and session returned | **PASS** | Centralized in `AuthContext` |
| 19 | `get-session` unauthenticated | No session cookie | `GET /api/auth/get-session` | 200 OK with `null`, `isAuthenticated: false`, navbar displays "Log In" | 200 OK with `null`, navbar shows "Log In" | **PASS** | Proper unauthenticated state |
| 20 | Browser refresh | Active authenticated session | `window.location.reload()` | Session restored via cookie hydration without re-login | Session restored, navbar shows user badge | **PASS** | Fully authoritative server session |
| 21 | New tab | Active session in Tab 1 | Open URL in Tab 2 | Tab 2 instantly inherits active session from cookie | Tab 2 authenticated | **PASS** | Same-origin cookie sharing |
| 22 | Logout across app | Active session in browser | Click "Log Out" | Session destroyed on server, `AuthContext` clears user/profile/preferences, redirects/updates UI | Session cleared, navbar becomes unauthenticated | **PASS** | Reactive state update |
| 23 | Protected API without session | Logged out client | `GET /api/user/profile` or `POST /api/chat` | 401 Unauthorized JSON response (`{ success: false, error: { code: 'UNAUTHORIZED' } }`) | 401 Unauthorized JSON | **PASS** | Server-side `requireAuth` guard |
| 24 | Protected API with session | Valid session cookie | `GET /api/user/profile` or `POST /api/chat` | 200 OK with requested user data / chat response | 200 OK | **PASS** | Verified in automated suite Test 5 |

---

## 5. USER PROFILE & PREFERENCES

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 25 | Email user profile provisioning | New email user created | Automatically invoked during first profile access / signup | BRAG `user_profile` and `user_preferences` rows created linked to Better Auth `user.id` | Rows created with default theme='dark' and model='gemini' | **PASS** | Foreign key to `user(id)` with ON DELETE CASCADE |
| 26 | Google user profile provisioning | Google OAuth login | Automatically invoked on first profile access / OAuth callback | BRAG `user_profile` and `user_preferences` created with Google display name / avatar | Rows created with provider details | **PASS** | Idempotent insertion |
| 27 | GitHub user profile provisioning | GitHub OAuth login | Automatically invoked on first profile access / OAuth callback | BRAG `user_profile` and `user_preferences` created with GitHub display name / avatar | Rows created with provider details | **PASS** | Idempotent insertion |
| 28 | Existing user without profile | Legacy Better Auth user | `GET /api/user/profile` | `ensureUserProfileAndPreferences` automatically provisions missing profile & preferences on the fly | Missing rows created dynamically, returns 200 OK | **PASS** | Self-healing profile architecture |
| 29 | Duplicate provisioning attempt | Existing profile in DB | Call `ensureUserProfileAndPreferences(userId)` twice concurrently | Idempotent `ON CONFLICT (user_id) DO NOTHING`, exactly one record preserved | 1 record preserved, 0 duplicates | **PASS** | Enforced by unique constraint on `user_id` |

---

## 6. PROTECTED CHAT ENDPOINT

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 30 | Logged-out chat | Unauthenticated client | `POST /api/chat` with `{ message: "Hello" }` | 401 Unauthorized JSON (`{ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }`) | 401 Unauthorized JSON | **PASS** | Blocks unauthorized LLM token usage |
| 31 | Logged-in email chat | Authenticated email user | `POST /api/chat` with valid diagnostic message | 200 OK with diagnostic finding, root cause, confidence, and telemetry; message saved under user ownership | 200 OK, response received and persisted | **PASS** | User ID associated with investigation |
| 32 | Logged-in Google chat | Authenticated Google user | `POST /api/chat` with diagnostic query | 200 OK, full investigation executed under authenticated identity | 200 OK | **PASS** | Production verified |
| 33 | Logged-in GitHub chat | Authenticated GitHub user | `POST /api/chat` with diagnostic query | 200 OK, full investigation executed under authenticated identity | 200 OK | **PASS** | Production verified |
| 34 | Invalid chat payload | Authenticated session | `POST /api/chat` with `{ message: "" }` | 400 Bad Request JSON (`{ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message is required.' } }`) | 400 Bad Request JSON | **PASS** | Defensive validation |
| 35 | Unknown API endpoint | Client calls non-existent route | `GET /api/non-existent-route-xyz` | 404 Not Found JSON (`{ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint ... not found.' } }`) | 404 Not Found JSON | **PASS** | Express 404 catch-all prevents HTML error pages |
| 36 | Upstream AI failure / rate limit | Provider unavailable | `POST /api/chat` during provider error | Clean fallback through provider chain or structured JSON error with 500/502/429 | Structured JSON error response | **PASS** | Provider Router fallback active |
| 37 | Client-supplied `userId` spoof attempt | Authenticated User A | `POST /api/chat` with `{ message: "test", userId: "user-b-id" }` | Server ignores client `userId` and binds interaction strictly to authenticated session `req.user.id` | Server uses `req.user.id`, User B remains untouched | **PASS** | Verified in automated suite Test 8 |

---

## 7. SECURITY & AUTHORIZATION

| # | Test Scenario | Preconditions | Request / Action | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 38 | No session cookie | No cookie header | `GET /api/investigations` | 401 Unauthorized JSON | 401 Unauthorized JSON | **PASS** | Rejection before business logic |
| 39 | Invalid session cookie | Forged / tampered cookie | `GET /api/investigations` with `better-auth.session_token=forged-token` | 401 Unauthorized JSON | 401 Unauthorized JSON | **PASS** | Cryptographic session check |
| 40 | Expired session | Expired token in database | `GET /api/investigations` with expired session | 401 Unauthorized JSON | 401 Unauthorized JSON | **PASS** | Verified in automated suite Test 4 |
| 41 | Attempt to access another user's data (IDOR) | User A authenticated | `GET /api/investigations/{invUserBId}` | 403 Forbidden JSON | 403 Forbidden JSON | **PASS** | Strict user ownership check |
| 42 | Attempt to spoof `userId` in profile update | User A authenticated | `PUT /api/user/profile` with `{ userId: "userBId", displayName: "Hacked" }` | Server updates User A profile only; User B profile remains unchanged | User A updated, User B untouched | **PASS** | Verified in automated suite Test 8 |
| 43 | API endpoint directly accessed without frontend | Raw curl / external client | `POST https://brag-better-rag.vercel.app/api/chat` | 401 Unauthorized JSON | 401 Unauthorized JSON | **PASS** | Same-origin rewrite enforces auth |
| 44 | API endpoint accessed with valid session | Browser / curl with cookie | `GET https://brag-better-rag.vercel.app/api/user/profile` | 200 OK JSON with profile and preferences | 200 OK JSON | **PASS** | Complete session hydration |

---

## SUMMARY

- **Total Test Cases:** 44
- **Passed:** 44
- **Failed:** 0
- **Pass Rate:** 100%
