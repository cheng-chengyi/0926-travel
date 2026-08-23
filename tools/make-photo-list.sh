#!/usr/bin/env bash
# 把 assets/photos/ 裡的檔名寫進 data/photos.json，讓 Service Worker 預先快取。
# 每次新增或刪除照片後，在專案根目錄執行一次： bash tools/make-photo-list.sh
cd "$(dirname "$0")/.." || exit 1
ls assets/photos 2>/dev/null | grep -Ei '\.(jpg|jpeg|png|webp)$' \
  | awk 'BEGIN{printf "["} {printf "%s\"%s\"", (NR>1?",":""), $0} END{print "]"}' \
  > data/photos.json
echo "已更新 data/photos.json："; cat data/photos.json
