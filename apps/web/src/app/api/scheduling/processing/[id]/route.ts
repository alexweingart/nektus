import { NextRequest, NextResponse } from 'next/server';
import { processingStateManager } from '@/server/ai-scheduling/processing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`🔍 Polling for processing state: ${id}`);

    const state = await processingStateManager.get(id);

    if (!state) {
      return NextResponse.json(
        { error: 'Processing state not found' },
        { status: 404 }
      );
    }

    console.log(`📦 Retrieved state for ${id}:`, {
      status: state.status,
      hasResult: !!state.result,
      hasError: !!state.error
    });

    // Return status based on current state
    switch (state.status) {
      case 'processing':
        return NextResponse.json({
          status: 'processing',
          processingId: id,
          message: state.progressMessage || 'Still processing your request...',
          progressType: state.progressType,
          result: state.result // Include partial result for streaming
        });

      case 'completed':
        if (!state.result) {
          return NextResponse.json(
            { error: 'Result not available' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          status: 'completed',
          processingId: id,
          result: state.result,
          message: state.progressMessage
        });

      case 'error':
        return NextResponse.json({
          status: 'error',
          processingId: id,
          error: state.error || 'Unknown error occurred'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid state' },
          { status: 500 }
        );
    }
  } catch (error) {
    console.error('Error retrieving processing state:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve processing state' },
      { status: 500 }
    );
  }
}
