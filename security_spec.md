# Firestore Security Specification

## 1. Data Invariants
- **User Profile Isolation**: A user's profile under `/users/{userId}` can only be read and written by the authenticated user whose `uid` matches `{userId}`.
- **Chat Session Isolation**: A user's chat sessions under `/users/{userId}/chats/{chatId}` can only be accessed (read, created, updated, deleted) by the authenticated user whose `uid` matches `{userId}`.
- **Identity Integrity**: The user profile document's email must match the auth token's email, and the userId must match the auth token's UID.
- **Size Boundaries**: Message and text fields must have length constraints to prevent resource exhaustion attacks.

## 2. The "Dirty Dozen" Payloads (Red Team Test Scenarios)
1. **Unauthenticated Read /users**: Try reading profile without login. (Deny)
2. **Identity Spoofing Profile**: Try creating `/users/attackerId` with user matching `victimId`. (Deny)
3. **Ghost Field Injection**: Add `isAdmin: true` during profile update. (Deny)
4. **Junk User ID**: Access user profile with 500-character junk string as `userId`. (Deny)
5. **Cross-User Chat Read**: Authenticated User A tries to read `/users/UserB/chats/chat1`. (Deny)
6. **Cross-User Chat Write**: Authenticated User A tries to write `/users/UserB/chats/chat1`. (Deny)
7. **Junk Chat ID**: Try writing to `/users/{userId}/chats/{chatId}` with 500-character junk string as `chatId`. (Deny)
8. **Malicious Message Array**: Inject a 5MB message string in the `messages` array of a chat session. (Deny)
9. **No Email Verification**: Attempt write when `request.auth.token.email_verified` is not present (or false) if strict validation is active. (Deny)
10. **Timestamp Tampering (Create)**: Provide a client-crafted future `createdAt` value instead of `request.time`. (Deny)
11. **Timestamp Tampering (Update)**: Provide a client-crafted past `updatedAt` value instead of `request.time`. (Deny)
12. **Malicious Chat Mode**: Send chat with mode `super-hacker` instead of the allowed schema enums. (Deny)

## 3. The Rules Draft
Rules will be drafted in `/firestore.rules` and tested via ESLint.
