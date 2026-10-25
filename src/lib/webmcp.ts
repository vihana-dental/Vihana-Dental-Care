/**
 * WebMCP (https://developer.chrome.com/docs/ai/webmcp) — exposes a few safe,
 * read-mostly tools to in-browser AI agents. Feature-detected: browsers
 * without `navigator.modelContext` skip it entirely.
 *
 * Deliberately nothing here submits a booking or sends a message. An agent
 * can look up information and open the booking form for the patient, but the
 * patient (not the agent) fills in and confirms it.
 */

type ToolResult = { content: { type: 'text'; text: string }[] };

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (args: any) => Promise<ToolResult> | ToolResult;
}

interface ModelContext {
  registerTool: (tool: WebMcpTool) => unknown;
}

const text = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

export interface WebMcpHandlers {
  openBooking: (serviceId?: string) => void;
  goToSection: (tab: string) => void;
}

const SECTIONS = ['home', 'about', 'services', 'team', 'blog', 'gallery', 'reviews', 'location'];

export function registerWebMcpTools(handlers: WebMcpHandlers): () => void {
  const ctx = (navigator as unknown as { modelContext?: ModelContext }).modelContext;
  if (!ctx || typeof ctx.registerTool !== 'function') return () => {};

  const tools: WebMcpTool[] = [
    {
      name: 'get_clinic_info',
      description:
        'Get Vihana Dental Care contact details, address, opening hours and Google rating (Kalapatti, Coimbatore).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const res = await fetch('/api/clinic-info');
        const data = await res.json();
        const { info } = data;
        return text({
          name: info?.name,
          address: [info?.address, info?.city, info?.state, info?.pincode].filter(Boolean).join(', '),
          phone: info?.phone,
          whatsapp: info?.whatsapp,
          hours: info?.workingHours,
          rating: info?.rating,
          totalReviews: info?.totalReviews,
          maps: info?.googleMapsUrl,
        });
      },
    },
    {
      name: 'list_dental_services',
      description: 'List the dental treatments Vihana Dental Care offers, with ids usable in open_booking_form.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const res = await fetch('/api/clinic-info');
        const data = await res.json();
        const services = Array.isArray(data.services) ? data.services : [];
        return text(
          services.map((s: any) => ({ id: s.id, name: s.name, category: s.category, description: s.shortDescription || s.description }))
        );
      },
    },
    {
      name: 'open_booking_form',
      description:
        'Open the online appointment booking form for the user to complete. Optionally pre-select a service by id (see list_dental_services). Does not book anything by itself.',
      inputSchema: {
        type: 'object',
        properties: { serviceId: { type: 'string', description: 'Optional service id to pre-select.' } },
      },
      execute: (args: { serviceId?: string }) => {
        handlers.openBooking(args?.serviceId);
        return text('The booking form is now open. The user must choose a date/time and confirm.');
      },
    },
    {
      name: 'go_to_section',
      description: 'Scroll the page to a section of the site.',
      inputSchema: {
        type: 'object',
        properties: { section: { type: 'string', enum: SECTIONS } },
        required: ['section'],
      },
      execute: (args: { section: string }) => {
        if (!SECTIONS.includes(args?.section)) return text(`Unknown section. Use one of: ${SECTIONS.join(', ')}`);
        handlers.goToSection(args.section);
        return text(`Showing the ${args.section} section.`);
      },
    },
  ];

  try {
    tools.forEach((t) => ctx.registerTool(t));
  } catch {
    /* an agent host rejected a tool — the site works the same without them */
  }
  return () => {};
}
