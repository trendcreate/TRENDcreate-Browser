# TRENDcreate Browser

TRENDcreate Browserは、ブラウザ機能と高機能な統合開発環境（IDE）を一つにまとめたElectron製デスクトップアプリケーションです。
Web制作やプログラミングのコーディングからプレビュー確認まで、シームレスに行うための様々な便利機能を搭載しています。

## 🚀 主な機能

- **カスタムブラウザ機能**
  - タブベースの快適なWebブラウジング
  - お気に入りやよく使うサイトにアクセスしやすい独自のホームページ機能
  - 検索エンジンとの連携

- **TRENDcreate IDE（統合開発環境）**
  - **Monaco Editor搭載:** VSCodeと同等の強力なコードエディタエンジンを使用
  - **Live Preview:** エディタの横でリアルタイムにコーディング結果を確認
  - **Live Server:** ローカルのプロジェクトフォルダを即座にローカルサーバーとしてホスティング
  - **ファイルツリー:** 直感的なUIでファイルやフォルダの操作・管理が可能
  - **画像プレビュー機能:** エディタ内で画像ファイルをクリックするだけで、プレビュー枠にネイティブの画像ビューアーを展開

- **プロジェクト管理機能（ポートフォリオ）**
  - 進行中・作成済みのプロジェクト（ワークスペース）を一覧表示
  - プロジェクトフォルダへのクイックアクセス

## 📦 開発環境のセットアップ

1. 本プロジェクトのディレクトリを作業フォルダとして配置します。
2. ターミナルで依存関係をインストールします。
   ```bash
   npm install
   ```
3. アプリケーションを開発モードで起動します。
   ```bash
   npm start
   ```

## 🛠️ ビルド（実行ファイルの作成）

アプリケーションを配布用の実行ファイル（`.exe`）にパッケージングするには、以下のコマンドを実行します。

```bash
# Windows用インストーラーのビルド
npm run build:win

# Windows用ポータブル版（インストール不要）のビルド
npm run build:win:portable
```

ビルドが完了すると、`dist` フォルダに生成されたファイルが出力されます。

## 💻 主な使用技術

- [Electron](https://www.electronjs.org/) - デスクトップアプリ構築用フレームワーク
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - コードエディタエンジン
- HTML / CSS / Vanilla JavaScript (一部 Tailwind CSS 使用)

## 📝 ライセンス

This project is licensed under the MIT License.
(Editor: Monaco Editor, MIT License (c) Microsoft Corporation.)
