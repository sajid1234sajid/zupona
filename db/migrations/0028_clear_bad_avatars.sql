-- Profile photos are now uploaded (/api/account/avatar) rather than pasted as
-- an address. Addresses pasted under the old form were stored as typed, and
-- at least one was a Google share link -- a web page, not a picture -- which
-- the account page drew as a broken image. Keep only what is a picture: an
-- upload in our own media store, or the photo Google sign-in provides.
UPDATE users
SET avatar_url = NULL
WHERE avatar_url IS NOT NULL
  AND avatar_url NOT LIKE '/api/media/avatars/%'
  AND avatar_url NOT LIKE 'https://lh3.googleusercontent.com/%';
