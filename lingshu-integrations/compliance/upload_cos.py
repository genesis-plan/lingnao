import os
from qcloud_cos import CosConfig, CosS3Client

# 凭据从环境变量读取，禁止硬编码（避免推到仓库被密钥扫描拦截/泄露）
SECRET_ID = os.environ.get("TENCENT_COS_SECRET_ID", "")
SECRET_KEY = os.environ.get("TENCENT_COS_SECRET_KEY", "")
if not SECRET_ID or not SECRET_KEY:
    raise SystemExit("缺少环境变量 TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY，未上传")
BUCKET = "hclj-1409755229"
REGION = "ap-guangzhou"
PREFIX = "lingshu-solver/"

base = os.path.dirname(os.path.abspath(__file__))
files = ["privacy.html", "terms.html", "pricing.html"]

config = CosConfig(Region=REGION, SecretId=SECRET_ID, SecretKey=SECRET_KEY)
client = CosS3Client(config)

for f in files:
    local = os.path.join(base, f)
    key = PREFIX + f
    with open(local, "rb") as fp:
        body = fp.read()
    client.put_object(Bucket=BUCKET, Body=body, Key=key,
                     ContentType="text/html; charset=utf-8")
    url = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/{key}"
    print("UPLOADED", key, "->", url)
print("ALL_DONE")
