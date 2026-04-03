# Markdown 链接测试文档

## 文件路径链接

点击以下路径测试链接检测：

- `test.md` - 相对路径
- `D:\claudeworkspace\remoteCli\test.md` - 绝对路径
- `./test.md` - 显式相对路径
- `packages/shared/README.md` - 项目内路径

## Markdown 链接语法

- [本地测试文档](test.md)
- [相对路径](./test.md)
- [绝对路径](D:\claudeworkspace\remoteCli\test.md)

## 混合内容

请查看 `test.md` 获取更多信息。

也可以查看 `packages/server/README.md` 或 `packages/web/README.md`。

## 边界情况

- 文件名带空格: `my file.md`
- 多个点: `test.file.md`
- 路径中有 .md: `docs/md/guide.md`

---

*用于测试终端中的 .md 路径检测功能*