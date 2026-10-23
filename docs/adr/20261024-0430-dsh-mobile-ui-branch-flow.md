# main へ直接 commit せず、作業ブランチ + PR + CI で統合する

- Status: accepted
- Date: 2026-10-24
- Task: T308

## Context

初回 commit は main に直接入れていた。このリポジトリは public で、~/.dsh/local-plugins から symlink されている。
そのため、チェックアウト中のブランチがそのまま稼働中の DSH に読み込まれる。

## 選択肢

1. main を保護対象とし、作業ブランチ → PR → CI 通過後に merge する。
2. main へ直接 commit し、CI だけを回す。

## 決定

選択肢 1。具体的な手順は docs/development.md に置く。

## 理由

- 共通ルールが base ブランチへの直接 push を禁止している。public リポジトリへの push / PR は都度承認が必要。
- 作業ブランチをチェックアウトしている間は、稼働中の DSH もそのブランチを読む。これを手順として明記し、
  実機確認をブランチ上で行えるようにする。
