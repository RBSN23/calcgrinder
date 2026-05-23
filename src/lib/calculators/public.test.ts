import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { fetchPublicCalculator } from './public';

const mockCreateClient = vi.mocked(createClient);

interface RpcResult {
  data: unknown;
  error: unknown;
}

function installRpc(result: RpcResult) {
  const rpc = vi.fn(async () => result);
  mockCreateClient.mockResolvedValue(
    { rpc } as unknown as never,
  );
  return rpc;
}

const TOKEN = 'test-token-1234567890ab';

const VALID_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  owner_id: '22222222-2222-2222-2222-222222222222',
  title: 'Mortgage',
  description: 'A mortgage calculator',
  theme_id: 'calcgrinder',
  public_token: TOKEN,
  published: true,
  soft_delete_at: null,
  updated_at: '2026-05-23T10:00:00.000Z',
  sections: [
    {
      id: 'section-1',
      title: 'Inputs',
      description: '',
      layout_pattern_id: 'single_column',
      display_order: 0,
      cells: [
        {
          id: 'cell-1',
          kind: 'input',
          name: 'principal',
          label: 'Principal',
          description: '',
          description_render: 'caption',
          value_type: 'currency',
          visibility: 'visible',
          editability: 'editable',
          default_value: 100000,
          formula: null,
          display_widget: 'number_field',
          display_format: 'auto',
          display_emphasis: 'plain',
          unit: null,
          numeric_min: null,
          numeric_max: null,
          numeric_step: null,
          select_options: null,
          currency_code: 'USD',
          card_accent: 'theme',
          card_background_tint: 'none',
          card_border: 'none',
          card_size_hint: 'narrow',
          text_size: 'm',
          text_colour: 'default',
          display_order: 0,
        },
      ],
    },
  ],
};

describe('fetchPublicCalculator', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null on empty token without calling RPC', async () => {
    const rpc = installRpc({ data: [], error: null });
    const result = await fetchPublicCalculator('');
    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns null when the RPC returns no rows (token not found)', async () => {
    installRpc({ data: [], error: null });
    const result = await fetchPublicCalculator('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when the RPC returns an error (does not throw)', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    installRpc({ data: null, error: { message: 'boom' } });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns status=ok with a fully-normalised calculator on the happy path', async () => {
    installRpc({ data: [VALID_ROW], error: null });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result).toEqual({
      status: 'ok',
      calculator: {
        id: VALID_ROW.id,
        owner_id: VALID_ROW.owner_id,
        title: VALID_ROW.title,
        description: VALID_ROW.description,
        theme_id: VALID_ROW.theme_id,
        public_token: VALID_ROW.public_token,
        published: true,
        updated_at: VALID_ROW.updated_at,
        sections: [
          {
            id: 'section-1',
            title: 'Inputs',
            description: '',
            layout_pattern_id: 'single_column',
            display_order: 0,
            cells: [
              expect.objectContaining({
                id: 'cell-1',
                kind: 'input',
                name: 'principal',
                label: 'Principal',
                value_type: 'currency',
                editability: 'editable',
                default_value: 100000,
                currency_code: 'USD',
                display_order: 0,
              }),
            ],
          },
        ],
      },
    });
  });

  it('returns status=gone when the calculator is soft-deleted (regardless of published flag)', async () => {
    installRpc({
      data: [
        {
          ...VALID_ROW,
          published: true,
          soft_delete_at: '2026-05-22T12:00:00.000Z',
        },
      ],
      error: null,
    });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result).toEqual({
      status: 'gone',
      soft_delete_at: '2026-05-22T12:00:00.000Z',
    });
  });

  it('returns status=ok for a Draft (published=false) calculator — token is the gate, not the flag', async () => {
    installRpc({
      data: [{ ...VALID_ROW, published: false }],
      error: null,
    });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.calculator.published).toBe(false);
    }
  });

  it('handles missing/empty sections array gracefully', async () => {
    installRpc({ data: [{ ...VALID_ROW, sections: null }], error: null });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.calculator.sections).toEqual([]);
    }
  });

  it('drops malformed section entries instead of crashing', async () => {
    installRpc({
      data: [
        {
          ...VALID_ROW,
          sections: [
            { id: 'good', title: 'Good', description: '', layout_pattern_id: 'single_column', display_order: 0, cells: [] },
            { id: 'no-title' }, // missing required fields
            null, // not an object
          ],
        },
      ],
      error: null,
    });
    const result = await fetchPublicCalculator(TOKEN);
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.calculator.sections).toHaveLength(1);
      expect(result.calculator.sections[0].id).toBe('good');
    }
  });

  it('sorts sections by display_order even when the RPC returns them out of order', async () => {
    installRpc({
      data: [
        {
          ...VALID_ROW,
          sections: [
            { id: 'b', title: 'B', description: '', layout_pattern_id: 'single_column', display_order: 1, cells: [] },
            { id: 'a', title: 'A', description: '', layout_pattern_id: 'single_column', display_order: 0, cells: [] },
          ],
        },
      ],
      error: null,
    });
    const result = await fetchPublicCalculator(TOKEN);
    if (result?.status === 'ok') {
      expect(result.calculator.sections.map((s) => s.id)).toEqual(['a', 'b']);
    }
  });

  it('calls the RPC with the token verbatim', async () => {
    const rpc = installRpc({ data: [VALID_ROW], error: null });
    await fetchPublicCalculator(TOKEN);
    expect(rpc).toHaveBeenCalledWith('fn_get_public_calculator', {
      p_token: TOKEN,
    });
  });
});
