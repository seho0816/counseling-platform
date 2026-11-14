# AI 요약 서버 (Python). backend/ai/summary 폴더에서 빌드한다.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 컨테이너 밖에서 접속하려면 0.0.0.0이어야 한다. 포트는 호스팅이 주는 PORT를 쓰고 없으면 10000.
ENV AI_HOST=0.0.0.0
EXPOSE 10000

# 키(GEMINI_API_KEY)와 접근 토큰(AI_SHARED_TOKEN)은 이미지에 넣지 않고 환경 변수로 준다.
CMD ["sh", "-c", "AI_PORT=${PORT:-10000} exec python server.py"]
