#!/bin/bash
cd "$(dirname "$0")"
export PATH="/usr/bin:/bin:/usr/local/bin:$HOME/bin"
git add -A
git commit -m "Обновление $(date '+%d.%m.%Y %H:%M')"
git push
echo "Готово! Сайт обновится через 1-2 минуты."
read -p "Нажмите Enter для закрытия..."
