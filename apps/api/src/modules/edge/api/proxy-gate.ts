import { ErrorCode } from '@indice/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppException } from '../../../common/app-exception';
import { HttpExceptionFilter } from '../../../common/http-exception.filter';
import { PROXY_SECRET_HEADER, proxySecretMatches } from '../domain/proxy-secret';

const OPEN_PATHS = new Set(['/api/v1/health']);

export function proxyGate(secret: string) {
  const filter = new HttpExceptionFilter();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (OPEN_PATHS.has(req.path) || proxySecretMatches(req.header(PROXY_SECRET_HEADER), secret)) {
      next();
      return;
    }
    const { status, body } = filter.toResponse(
      new AppException(ErrorCode.Forbidden, 403, 'Esta API solo responde a la web de Índice'),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(body);
  };
}
