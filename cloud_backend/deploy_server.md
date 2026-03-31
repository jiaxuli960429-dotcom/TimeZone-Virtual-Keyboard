# 云端后端部署（ECS）

以下步骤用于在你的 ECS 上将 `cloud_backend` 以 `systemd` 常驻运行，并通过 Nginx 暴露为 `/api` 与 `/ws/realtime`。

## 1) 上传代码到服务器

建议目录：

- `/opt/launch-advisor/app/TimeZone-Virtual-Keyboard`

可用 `git clone` 或 `scp/rsync` 上传。

## 2) 创建 Python 虚拟环境并安装依赖

```bash
cd /opt/launch-advisor/app/TimeZone-Virtual-Keyboard/cloud_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3) 安装 systemd 服务

```bash
cp systemd/timezone-cloud-backend.service /etc/systemd/system/
```

若你的项目目录不是文档里的默认值，请先修改服务文件中的 `WorkingDirectory` 与 `ExecStart`。

## 4) 启动并设置开机自启

```bash
systemctl daemon-reload
systemctl enable --now timezone-cloud-backend
systemctl status timezone-cloud-backend --no-pager
```

## 5) 健康检查

```bash
curl -sS http://127.0.0.1:8000/healthz
```

期望返回：

```json
{"ok":"true"}
```

## 6) 日志排查

```bash
journalctl -u timezone-cloud-backend -n 100 --no-pager
```

同时会写入按文件归档日志（按天轮转，保留 30 份）：

- `/opt/launch-advisor/logs/backend/app.log`
- `/opt/launch-advisor/logs/backend/realtime.log`

查看：

```bash
ls -lah /opt/launch-advisor/logs/backend
tail -f /opt/launch-advisor/logs/backend/realtime.log
```
