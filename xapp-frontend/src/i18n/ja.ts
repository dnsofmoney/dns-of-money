// Japanese (日本語) message catalog.
// Typed as Messages, so a missing or misnamed key fails the build — the
// English catalog (en.ts) stays the single source of truth for the shape.

import type { Messages } from "./en";

export const ja: Messages = {
  common: {
    brand: "DNS://Money",
    loading: "読み込み中…",
    back: "← 戻る",
    sessionUnavailable: "セッションを利用できません — xAppを再起動してください。",
    preparing: "準備中…",
    waitingSignature: "署名を待っています…",
    rejectedInXaman: "Xamanで拒否されました",
    signTimedOut: "署名リクエストがタイムアウトしました",
    serverError: "サーバーエラー {status}",
  },

  tabs: {
    register: "エイリアス取得",
    send: "送金",
    gallery: "ギャラリー",
    buy: "入金",
  },

  steps: {
    chooseName: "名前を選択",
    confirm: "確認",
    sign: "署名",
  },

  avail: {
    checking: "確認中…",
    available: "✓ 利用可能",
    taken: "✗ 使用済み",
    reserved: "✗ 予約済みの名前",
    invalid: "✗ 形式が無効です",
  },

  mintStatus: {
    preparing: "準備中…",
    rendering: "アイデンティティを生成中…",
    uploading: "IPFSにアップロード中…",
    minting: "XRP Ledgerでミント中…",
    complete: "アイデンティティをミントしました",
    working: "処理中…",
  },

  register: {
    alreadyTitle: "すでに登録済みです",
    oneAliasPerWallet:
      "ウォレットごとにエイリアスは1つです。Sendタブから DNS://Money の誰にでも支払えます。",

    doneTitle: "登録完了。",
    doneSubtitle: "あなたのエイリアスは XRP Ledger 上で有効です",
    nftClaimed: "NFTを受け取りました — Xamanウォレットに入っています。",
    nftReadyHint:
      "アイデンティティNFTがミントされました。署名するだけでウォレットに受け取れます（支払い不要）。",
    openingXaman: "Xamanを開いています…",
    claimNft: "NFTをウォレットに受け取る",
    mintRetrying:
      "ミント中に問題が発生しました。エイリアスは安全に予約されています — 担当チームに通知され、まもなくミントを完了します。",
    mintTakesAMinute: "通常1〜2分かかります。",
    registerAnother: "別のエイリアスを登録",

    step1Title: "名前を選択",
    step1Subtitle: "XRP Ledger 上のあなたの永久支払いエイリアス",
    // Aliases are Latin-only (input strips to lowercase ascii), so the
    // placeholder stays Latin to avoid inviting kana that would fail validation.
    namePlaceholder: "yourname",
    continue: "続ける →",

    step2Title: "エイリアスを確認",
    step2Subtitle: "署名する前に内容をご確認ください",
    rowAlias: "エイリアス",
    rowYouGet: "取得内容",
    youGetValue: "エイリアス＋アイデンティティNFT",
    rowCost: "費用",
    costValue: "{price} XRP",
    rowSlotsRemaining: "残り枠",
    rowRegisteredTo: "登録先",
    registerAndMint: "登録してミント",

    step3Title: "Xamanで署名",
    registeringAlias: "エイリアスを登録中…",
    approveInXaman: "Xamanウォレットで支払いを確認し、承認してください。",
    almostDone: "もうすぐ完了",
  },

  send: {
    sentTitle: "送金しました！",
    transactionId: "トランザクションID",
    sendAgain: "もう一度送金",
    sendToAlias: "送金先エイリアス",
    aliasPlaceholder: "pay:name",
    rowTo: "宛先",
    rowAddress: "アドレス",
    rowFee: "手数料",
    amountLabel: "金額（XRP）",
    memoLabel: "メモ（任意）",
    memoPlaceholder: "用途は？",
    signAndSend: "署名して送金",
    aliasNotFound: "エイリアスが見つかりません",
    couldNotResolve: "エイリアスを解決できませんでした",
  },

  gallery: {
    title: "ファウンディング・アイデンティティ",
    countMinted: "XRP Ledger 上で{count}件ミント済み",
    loadError: "ギャラリーを読み込めませんでした — しばらくして再度お試しください。",
    empty: "まだミントされたアイデンティティはありません。",
    viewIdentity: "{alias} を全画面で表示",
    openImage: "画像を開く",
    close: "閉じる",
  },

  buy: {
    title: "XRPを追加",
    intro:
      "カードまたはApple Payで pay:name に入金します。MoonPayが処理し、DNS://Money が資金に触れることはありません。",
    deliverToAlias: "届け先エイリアス",
    rowTo: "宛先",
    rowAddress: "アドレス",
    aliasNotFound: "エイリアスが見つかりません",
    noXrplAddress: "エイリアスにXRPLアドレスがありません",
    notAvailable: "現在入金はご利用いただけません",
    couldNotResolve: "エイリアスを解決できませんでした",
    preparingCheckout: "チェックアウトを準備中…",
    buyXrp: "MoonPayへ進む",
    checkoutOpened:
      "ブラウザでチェックアウトを開きました。そちらで完了してください — MoonPayの決済後、XRPが{alias}に届きます。",
    couldNotStart: "チェックアウトを開始できませんでした",
  },
};
