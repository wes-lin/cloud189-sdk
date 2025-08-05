#!/bin/bash

mkdir -p .temp

if [ -d ".temp" ]; then
    echo "正在清理旧文件..."
    rm -f .temp/random_*.txt
    echo "旧文件清理完成"
fi

json_array="[]"
File_NAME="random_$(date +%s)"
for num in {1..4}
do
    part_file_name="${File_NAME}_${num}.txt"
    dd if=/dev/urandom of=".temp/$part_file_name" bs=1024 count=20000
        # 获取文件大小（字节）
    file_size=$(stat -c%s ".temp/$part_file_name")

    # 获取文件MD5校验值
    file_md5=$(md5sum ".temp/$part_file_name" | awk '{print $1}')

    # 将文件信息添加到JSON数组
    json_array=$(echo "$json_array" | jq --arg name "$part_file_name" \
                                         --arg size "$file_size" \
                                         --arg md5 "$file_md5" \
                                         '. += [{"filename": $name, "size": $size|tonumber, "md5": $md5}]')
done
echo "$json_array" > .temp/files.json
echo "File information saved to files.json"
