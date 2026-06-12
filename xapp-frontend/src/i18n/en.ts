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
    serverError: "Server error {status}",
  },

  tabs: {
    register: "Get Alias",
    send: "Send",
    gallery: "Gallery",
    buy: "Buy",
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
  },

  buy: {
    title: "Buy XRP",
    intro:
      "Buy with a card or Apple Pay, delivered to any pay:name. Handled by MoonPay — DNS://Money never touches your funds.",
    deliverToAlias: "Deliver to alias",
    rowTo: "To",
    rowAddress: "Address",
    aliasNotFound: "Alias not found",
    noXrplAddress: "Alias has no XRPL address",
    notAvailable: "Buy isn't available right now",
    couldNotResolve: "Could not resolve alias",
    preparingCheckout: "Preparing checkout…",
    buyXrp: "Buy XRP",
    checkoutOpened:
      "Checkout opened in your browser. Finish there — XRP arrives at {alias} when MoonPay settles.",
    couldNotStart: "Could not start checkout",
  },
};

export type Messages = typeof en;
