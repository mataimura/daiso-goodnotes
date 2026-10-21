# DAISO Ink → Goodnotes（無料・iPhone Safari試作版）

10.5インチのDAISO電子メモパッドに書いた内容を、iPhone内で撮影→画面自動検出→青緑の筆跡抽出→Goodnotesの編集可能な擬似ストロークに変換する静的Webアプリです。

## 使い方

iPhoneの**SafariでHTTPSのURL**を開いて使います。初めての利用ではネット接続が必要ですが、初回読み込み後はサービスワーカーによりオフラインで使える設計です（iOSのキャッシュ削除状況等に依存）。写真は端末外に送信しません。

1. `index.html` を含むこのフォルダの**中身全部**を、GitHub Pages等の静的ホスティングに置く。※公開リポジトリに個人の撮影写真を入れないこと。
2. iPhone SafariでそのURLにアクセスし、「共有」→「ホーム画面に追加」。
3. 写真を撮る・選ぶ（HEIC/JPEG/PNG）。10.5インチ縦向きの写真が対象。
4. 青緑の枠が液晶の内側に沿っているか確認する。ずれていれば「四隅を修正」で丸印をドラッグ。
5. 感度を調整して「デジタルインクに変換する」。プレビューを確認。
6. 「Goodnotesへ共有」→Goodnotesを選ぶ。共有が使えない場合は「.goodnotesを保存」、Goodnotesで「読み込む」を選ぶ。

## GitHub Pagesで無料公開する手順（写真は公開しない）

1. GitHubにサインイン→新しい**public**リポジトリを作る（例：`daiso-ink`）。
2. このZIPを展開してできた `index.html`, `app.js`, `pipeline.js`, `goodnotes.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `vendor/` をリポジトリの最上位にアップロードする。テスト写真はアップロード不要。
3. Repository Settings → Pages → Deploy from a branch → `main` / `(root)` → Save。
4. 表示されたURL（通常 `https://ユーザー名.github.io/daiso-ink/`）をiPhone Safariで開く。
5. Safariの共有ボタン →「ホーム画面に追加」。

GitHub Pagesに置く**プログラム自体は公開**されますが、撮影した写真・生成した筆跡は端末内で処理され、サーバーには送信されません。公開が不安なら自分だけのiPhoneローカルサーバー等でも動かせますが、ホーム画面・オフライン機能にはHTTPS配信が推奨です。

## 技術・注意事項

- 変換処理: JavaScript + Canvas API。スケルトン化はZhang–Suen、細線トレースは8近傍グラフ、独自Goodnotes schema-24 / Protobuf + LZ4ブロック + ZIP。
- JSZip 3.10.1（MITライセンス）はアプリに同梱。外部CDN不要。
- `goodnotes.js` は**非公式な**Goodnotesファイル形式。iOSアプリの更新により互換性が変わる可能性があります。元の写真は必ず保持してください。
- Mac版のOpenCV/SciPyとJavaScript実装は近い処理を行いますが**同一ではありません**。輪郭検出・線の復元品質は端末・写真によって違い、Mac版と同等の精度は保証できません。
- 指の影、周囲の強い反射、端末が一部見切れた写真は自動検出に失敗することがあります。その場合、四隅手動調整と感度変更を試してください。
- 初期版は**1回につき1枚**です。複数ページの一括編集は次の拡張候補。
- 正式なiPhone Safari実機テストはまだ完了していません。最初に投げ縄・消しゴムで編集できるか検証してください。

## 追加：単体HTML版

`DAISO_Goodnotes_offline.html` には画像処理とGoodnotes形式生成プログラムをすべて埋め込んでいます。MacやPCのブラウザでは、HTMLファイルを開くだけでテストできます（ブラウザ設定による制約あり）。iPhoneの「ファイル」アプリからHTMLを開く方法はSafariへ渡らない場合があるため、**iPhoneで日常的に使う場合はGitHub Pages版を推奨**します。

## 開発者向け検証メモ

- ブラウザでの画面自動検出・筆跡抽出・ZIP書き出しはChromiumで2枚のサンプル写真についてE2E検証済み。
- 元のPythonコードで使う`verify_goodnotes_archive()`を使い、ブラウザ出力2件のGoodnotesストロークを復号済み。
- 実iPhone SafariおよびGoodnotes上のインポート・投げ縄・消しゴムは未検証。最初に実機チェックが必要。
- 保守上の注意：Goodnotes独自の非公式形式は将来変更される可能性があります。
