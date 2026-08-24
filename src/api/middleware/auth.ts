import type { NextFunction, Request, Response } from "express";
import { errorBody } from "../response.js";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // 서버 설정 문제(키 미설정)를 클라이언트 인증 실패와 구분해서 500으로 응답
    res.status(500).json(errorBody("서버에 API_KEY가 설정되지 않았습니다."));
    return;
  }

  const provided = req.header("x-api-key");
  if (provided !== apiKey) {
    res.status(401).json(errorBody("유효하지 않은 API 키입니다. x-api-key 헤더를 확인하세요."));
    return;
  }

  next();
}
