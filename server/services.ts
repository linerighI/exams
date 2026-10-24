import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { layers, subjectServices } from '../src/serviceCatalog';
import { mathQuestionIssues } from '../src/mathQuality';
export function registerServices(
  app: FastifyInstance,
  auth: (req: any) => any,
  teacher: (req: any) => any,
) {
  app.get('/api/services', async (req) => {
    auth(req);
    return { layers, subjects: subjectServices };
  });
  app.post('/api/services/math/check', async (req) => {
    teacher(req);
    const question = z
      .object({
        text: z.string().max(2000),
        explanation: z.string().max(3000).optional(),
        options: z.array(z.string().max(800)).max(20).optional(),
        kind: z.string().max(20).optional(),
        requiresImage: z.boolean().optional(),
        image: z.string().max(3000000).optional(),
      })
      .parse(req.body);
    return {
      service: 'math',
      version: 1,
      issues: mathQuestionIssues(question),
      scope: 'notation-and-numeric-options',
      requiresTeacherReview: true,
    };
  });
}
