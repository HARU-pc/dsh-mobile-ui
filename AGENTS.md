# dsh-mobile-ui 作業ルール

- ADR Level: 3（docs/adr/。採番は `YYYYMMDD-HHMM-<slug>.md`、索引は docs/adr/README.md）
- 入口: 仕様は docs/spec.md、開発手順・ブランチ運用・テストは docs/development.md、既知の問題は docs/known-issues.md。
- main へは直接 commit しない（ADR-20261024-0430）。このリポジトリは public なので、push・PR・issue の作成は都度承認を得る。
- `~/.dsh/local-plugins/dsh-mobile-ui` はこのディレクトリへの symlink。チェックアウト中のブランチが稼働中の DSH Web に読み込まれる。
- 変更したら `npm test` を通す。spec.md の契約を変えたら、同じ変更の中でテスト・spec.md を更新する。
- DSH 本体（`@deepseek-ai/*` 0.2.0-rc.2）の挙動を根拠にするときは、配布物の該当箇所を確認し、docs に版を明記する。
