// English message catalog — the source of truth for the i18n layer.
// The shape of this object *is* the Messages type (see ja.ts / index.tsx),
// so every other locale must provide exactly these keys.
//
// Interpolation: use {name} placeholders, filled by t(key, { name: value }).

export const en = {
  common: {
    brand: "DNS://Money",
    loading: "Loading…",
    back: "← Back",
    sessionUnavailable: "Session unavailable — relaunch the xApp.",
    preparing: "Preparing…",
    waitingSignature: "Waiting for signature…",
    rejectedInXaman: "Rejected in Xaman",
    signTimedOut: "Sign request timed out",
    signOpenFailed: "Couldn't open the sign request — try the options below.",
    serverError: "Server error {status}",
  },

  tabs: {
    register: "Get Alias",
    send: "Send",
    gallery: "Gallery",
    buy: "Fund",
    cold: "Cold",
  },

  cold: {
    title: "Cold vault",
    intro:
      "Pay from an XRP account whose key stays on your Ledger. This app only asks. You approve every payment on the Ledger at your desktop. This app holds no key for that account.",
    codeLabel: "Pairing code",
    pair: "Pair",
    pairing: "Pairing…",
    pairHelp: "Start the bridge on your desktop. It shows an 8-digit code that works once for 10 minutes.",
    badCode: "That code is wrong or has expired.",
    locked: "Too many wrong codes. Try again in 15 minutes.",
    sessionEnded: "The pairing ended. Pair again with a new code.",
    vault: "Vault account",
    onlyLedger: "Only a signature from your Ledger can move funds from this account.",
    to: "To",
    toSelf: "You cannot pay the vault account itself.",
    aliasNotFound: "No pay:name found.",
    aliasNoAddress: "That name has no XRP address.",
    couldNotResolve: "Could not look up that name.",
    amount: "Amount (XRP)",
    amountBad: "Enter a number above 0 with at most 6 decimals.",
    note: "Note (optional)",
    noteHelp: "The note shows in the approver app. It does not show on the Ledger screen.",
    send: "Ask my Ledger to pay",
    sending: "Sending…",
    requests: "Requests",
    empty: "No requests yet.",
    check: "Check status",
    forget: "Forget this vault",
    failedWhy: "The desktop gate refused this request. Nothing was sent.",
    tooManyOpen: "Ten requests are already open. Finish or wait for them first.",
    badInput: "The relay refused that request. Check the address and amount.",
    network: "Could not reach the relay.",
    generic: "Something went wrong. Try again.",
    status: {
      QUEUED: "Waiting for your desktop",
      PENDING_APPROVAL: "Approve on your Ledger",
      APPROVED: "Signing on your Ledger",
      CONFIRMED: "Sent",
      REJECTED: "Refused on the Ledger. Nothing was sent.",
      FAILED: "Failed. Nothing was sent.",
      EXPIRED: "Expired. Nothing was sent.",
    },
  },

  steps: {
    chooseName: "Choose name",
    confirm: "Confirm",
    sign: "Sign",
  },

  avail: {
    checking: "Checking…",
    available: "✓ Available",
    taken: "✗ Already taken",
    reserved: "✗ Reserved name",
    invalid: "✗ Invalid format",
  },

  mintStatus: {
    check: "Check status",
    preparing: "Preparing…",
    rendering: "Rendering your identity…",
    uploading: "Uploading to IPFS…",
    minting: "Minting on the XRP Ledger…",
    complete: "Identity minted",
    working: "Working…",
  },

  register: {
    // Already-registered state
    alreadyTitle: "You're already registered",
    oneAliasPerWallet:
      "One alias per wallet. Use the Send tab to pay anyone on DNS://Money.",

    // Done state
    doneTitle: "You're in.",
    doneSubtitle: "Your alias is live on the XRP Ledger",
    nftClaimed: "NFT claimed — it's in your Xaman wallet.",
    nftReadyHint:
      "Your identity NFT is minted. Claim it to your wallet — no payment, just a signature.",
    openingXaman: "Opening Xaman…",
    claimNft: "Claim NFT to wallet",
    mintRetrying:
      "Minting hit a snag. Your alias is safe and reserved — our team has been notified and will finish the mint shortly.",
    mintTakesAMinute: "This usually takes a minute or two.",
    registerAnother: "Register another",

    // Step 1
    step1Title: "Choose your name",
    step1Subtitle: "Your permanent payment alias on the XRP Ledger",
    namePlaceholder: "yourname",
    continue: "Continue →",

    // Step 2
    step2Title: "Confirm your alias",
    step2Subtitle: "Review the details before signing",
    rowAlias: "Alias",
    rowYouGet: "You get",
    youGetValue: "Alias + identity NFT",
    rowCost: "Cost",
    costValue: "{price} XRP",
    rowSlotsRemaining: "Slots remaining",
    rowRegisteredTo: "Registered to",
    registerAndMint: "Register & Mint",

    // Step 3
    step3Title: "Sign in Xaman",
    registeringAlias: "Registering your alias…",
    approveInXaman: "Review and approve the payment in your Xaman wallet.",
    almostDone: "Almost done",
  },

  send: {
    sentTitle: "Sent!",
    transactionId: "Transaction ID",
    sendAgain: "Send again",
    sendToAlias: "Send to alias",
    aliasPlaceholder: "pay:name",
    rowTo: "To",
    rowAddress: "Address",
    rowFee: "Fee",
    amountLabel: "Amount (XRP)",
    memoLabel: "Memo (optional)",
    memoPlaceholder: "What's this for?",
    signAndSend: "Sign & Send",
    aliasNotFound: "Alias not found",
    couldNotResolve: "Could not resolve alias",
  },

  gallery: {
    title: "Founding identities",
    countMinted: "{count} minted on the XRP Ledger",
    loadError: "Could not load the gallery — try again shortly.",
    empty: "No identities minted yet.",
    viewIdentity: "View {alias} full size",
    openImage: "View Full Image",
    send: "Send",
    close: "Close",
    prev: "Previous",
    next: "Next",
    position: "{index} of {total}",
    copyTokenId: "Copy token ID",
    tokenIdCopied: "Token ID copied ✓",
  },

  buy: {
    title: "Fund",
    intro:
      "Add XRP to your wallet or to a pay:name, so you can pay and send with it. MoonPay is a third party. It sets its own fees and may ask for ID. DNS://Money never touches your funds.",
    deliverToAlias: "Deliver to alias",
    rowTo: "To",
    rowAddress: "Address",
    aliasNotFound: "Alias not found",
    noXrplAddress: "Alias has no XRPL address",
    notAvailable: "Funding isn't available right now",
    couldNotResolve: "Could not resolve alias",
    preparingCheckout: "Preparing checkout…",
    buyXrp: "Continue to MoonPay",
    checkoutOpened:
      "Checkout opened in your browser. Finish there — XRP arrives at {alias} when MoonPay settles.",
    couldNotStart: "Could not start checkout",
  },

  sign: {
    notOpening: "Sign request didn't open?",
    reopen: "Open sign request",
    openInXaman: "Not opening? Open in Xaman →",
  },

  legal: {
    terms: "Terms",
    privacy: "Privacy",
    support: "Support",
  },
};

export type Messages = typeof en;
