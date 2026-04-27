import { NextRequest, NextResponse } from 'next/server';
import { requireSession, submitInvoiceToMiddleware, addWorkflowComment } from '@/lib/bank/product-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(req, ['Approver', 'Admin']);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Add optional comment before submission
    if (body.comment) {
      await addWorkflowComment(session.user, id, body.comment);
    }

    const result = await submitInvoiceToMiddleware(session.user, id);
    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          invoice: (result as any).invoice,
          middlewareResponse: (result as any).middlewareResponse,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
