window.OL_CONFIG = Object.freeze({
  APP_NAME: 'Open Loops',
  SUPABASE_URL: 'https://ujscnncechcwqhidzdgd.supabase.co',
  SUPABASE_KEY: 'sb_publishable_5HOKU2MF9V41NMhnYntyGw_8J0rwUZh',
  // null = auto-detects current page URL. Set to a specific URL only if you
  // need a custom redirect (e.g., forcing staging to redirect to production).
  EMAIL_REDIRECT_TO: null,

  // Public half of the key that signs daily nudges (web push). The private
  // half lives in Supabase Vault. null turns nudges off.
  VAPID_PUBLIC_KEY: 'BElqKwXhYnzUe75oSOnXB6glvU5BkQw8dC6BhKPjOn8C0jD0lQYk_BV4l-AHejLpi89dVCEZRVqLZx0WeqDnQR4',

  STORAGE_KEY: 'open_loops_data'
});
