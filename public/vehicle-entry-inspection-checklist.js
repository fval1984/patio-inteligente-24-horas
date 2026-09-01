/**
 * Checklist da vistoria — 4 modalidades independentes (somente dados).
 */
(function vehicleEntryInspectionChecklistModule(global) {
  "use strict";

  const BODY = ["BOM", "REGULAR", "DANIFICADO", "INEXISTENTE"];
  const FULL = ["BOM", "REGULAR", "DANIFICADO", "SEM_TESTE", "INEXISTENTE"];
  const CALOTA = ["BOM", "REGULAR", "DANIFICADO"];

  const SIM_NAO = [
    { value: "SIM", label: "Sim" },
    { value: "NAO", label: "Não" },
  ];
  const FUEL_TYPES = [
    { value: "GASOLINA", label: "Gasolina" },
    { value: "ETANOL", label: "Etanol" },
    { value: "DIESEL", label: "Diesel" },
    { value: "FLEX", label: "Flex" },
    { value: "ELETRICO", label: "Elétrico" },
    { value: "HIBRIDO", label: "Híbrido" },
  ];
  const RETRO_TYPES = [
    { value: "ELETRICO", label: "Elétrico" },
    { value: "MANUAL", label: "Manual" },
  ];
  const WHEEL_TYPES = [
    { value: "LIGA", label: "Liga" },
    { value: "FERRO", label: "Ferro" },
    { value: "AUSENTE", label: "Ausente" },
  ];
  const TIRE_STATES = [
    { value: "NOVO", label: "Novo" },
    { value: "BOM_ESTADO", label: "Bom estado" },
    { value: "MEIA_VIDA", label: "Meia vida" },
    { value: "CARECA", label: "Careca" },
    { value: "AUSENTE", label: "Ausente" },
  ];

  function cls(key, label, opts) {
    return { key, label, kind: "classify", classIds: FULL, ...(opts || {}) };
  }
  function body(key, label, opts) {
    return cls(key, label, { classIds: BODY, ...(opts || {}) });
  }
  function txt(key, label, placeholder) {
    return { key, label, kind: "text", placeholder: placeholder || "" };
  }
  function num(key, label) {
    return { key, label, kind: "number", required: true };
  }
  function choice(key, label, choices, opts) {
    return { key, label, kind: "choice", choices: choices || [], required: true, ...(opts || {}) };
  }
  function pick(key, label, options, opts) {
    return { key, label, kind: "pick", options: options || [], required: true, ...(opts || {}) };
  }
  function tire(key, label, marcaKey, refKey) {
    return pick(key, label, TIRE_STATES, {
      textKey: marcaKey,
      textLabel: "Marca",
      textPlaceholder: "Marca",
      textKey2: refKey,
      textLabel2: "Referência",
      textPlaceholder2: "Referência",
    });
  }
  function wheel(key, label) {
    return pick(key, label, WHEEL_TYPES);
  }
  function calota(key, label) {
    return cls(key, label, { classIds: CALOTA });
  }

  const DIAGRAMS = {
    LEVE: "/vehicle-inspection-diagram-4v.webp",
    PESADOS: "/vehicle-inspection-diagram-pesados.webp",
    TRATORES: "/vehicle-inspection-diagram-tratores.webp",
    MOTOS: "/vehicle-inspection-diagram-motos.webp",
  };

  function sideBody(prefix) {
    return [
      body(prefix + "_para_lama_diant", "Paralama dianteiro"),
      body(prefix + "_para_lama_tras", "Paralama traseiro"),
      body(prefix + "_porta_diant", "Porta dianteira"),
      body(prefix + "_friso_porta_diant", "Friso porta dianteira"),
      body(prefix + "_porta_tras", "Porta traseira"),
      body(prefix + "_friso_porta_tras", "Friso porta traseira"),
    ];
  }

  const LEVE_CARDS = [
    {
      id: "geral",
      title: "INFORMAÇÕES INICIAIS",
      blocks: [
        {
          title: "Chaves e documentação",
          items: [
            choice("ini_chave_ignicao", "Possui chave de ignição?", SIM_NAO),
            choice("ini_chave_reserva", "Possui chave reserva?", SIM_NAO),
            choice("ini_manual", "Possui manual?", SIM_NAO),
            choice("ini_documento", "Possui documento?", SIM_NAO),
          ],
        },
        {
          title: "Situação do veículo",
          items: [
            choice("ini_funcionando", "Veículo funcionando?", SIM_NAO),
            choice("ini_trancado", "Veículo trancado?", SIM_NAO),
            choice("ini_travado", "Veículo travado?", SIM_NAO),
          ],
        },
        {
          title: "Combustível e KM",
          items: [
            choice("ini_combustivel", "Tipo de combustível:", FUEL_TYPES),
            num("ini_km", "KM"),
          ],
        },
        { title: "Nível de combustível", fuelGauge: true, items: [] },
      ],
    },
    {
      id: "retrovisor",
      title: "RETROVISOR",
      blocks: [
        {
          items: [
            choice("rev_tipo", "Tipo", RETRO_TYPES),
            cls("ldir_retrovisor", "Retrovisor LD"),
            cls("lesq_retrovisor", "Retrovisor LE"),
          ],
        },
      ],
    },
    {
      id: "espelho",
      title: "ESPELHO RETROVISOR",
      blocks: [
        {
          items: [cls("esp_ld", "LD"), cls("esp_le", "LE")],
        },
      ],
    },
    {
      id: "macaneta_ext",
      title: "MAÇANETA EXTERNA",
      blocks: [
        {
          items: [
            cls("mac_dle", "DLE"),
            cls("mac_tle", "TLE"),
            cls("mac_dld", "DLD"),
            cls("mac_tld", "TLD"),
          ],
        },
      ],
    },
    {
      id: "vidros",
      title: "VIDROS",
      blocks: [
        {
          items: [
            body("dian_para_brisa", "Para-brisa"),
            body("tras_vidro", "Vidro traseiro"),
            body("vid_led", "LED"),
            body("vid_let", "LET"),
            body("vid_ldd", "LDD"),
            body("vid_ldt", "LDT"),
          ],
        },
      ],
    },
    {
      id: "dianteira",
      title: "DIANTEIRA",
      blocks: [
        {
          items: [
            body("dian_capo", "Capô"),
            body("dian_para_choque", "Para-choque"),
            cls("dian_limp_ld", "Limpador de para-brisa LD"),
            cls("dian_limp_le", "Limpador de para-brisa LE"),
            cls("dian_farol_ld", "Farol LD"),
            cls("dian_farol_le", "Farol LE"),
            cls("dian_farol_aux_ld", "Farol auxiliar LD"),
            cls("dian_farol_aux_le", "Farol auxiliar LE"),
            body("dian_teto", "Teto"),
            body("dian_sala", "Saia"),
            body("dian_grade", "Grade"),
          ],
        },
      ],
    },
    {
      id: "traseira",
      title: "TRASEIRA",
      blocks: [
        {
          items: [
            body("tras_capo", "Tampa de mala"),
            cls("tras_macaneta", "Maçaneta"),
            cls("tras_limpador", "Limpador de para-brisa"),
            body("tras_para_choque", "Para-choque"),
            body("tras_lanterna_ld", "Lanterna LD"),
            body("tras_lanterna_le", "Lanterna LE"),
            body("tras_escapamento", "Escapamento"),
            body("tras_sala", "Saia"),
            body("tras_engate", "Engate"),
          ],
        },
      ],
    },
    {
      id: "lado_esquerdo",
      title: "LATERAL ESQUERDA",
      blocks: [{ items: sideBody("lesq") }],
    },
    {
      id: "lado_direito",
      title: "LATERAL DIREITA",
      blocks: [{ items: sideBody("ldir") }],
    },
    {
      id: "mecanica",
      title: "MECÂNICA",
      blocks: [
        {
          items: [
            cls("mec_bateria", "Bateria"),
            cls("mec_motor", "Motor"),
            cls("mec_arrefecimento", "Sistema de arrefecimento"),
            cls("mec_motor_arranque", "Motor de partida"),
            cls("mec_ar_condicionado", "Ar condicionado"),
            cls("mec_dir_hidraulica", "Direção hidráulica"),
            cls("mec_dir_eletrica", "Direção elétrica"),
            cls("mec_dir_mecanica", "Direção mecânica"),
            cls("mec_cambio_manual", "Câmbio manual"),
            cls("mec_cambio_aut", "Câmbio automático"),
            cls("mec_freio_estacionamento", "Freio de estacionamento"),
            cls("mec_freio", "Freio"),
            cls("mec_embreagem", "Embreagem"),
          ],
        },
      ],
    },
    {
      id: "pneus",
      title: "PNEUS",
      blocks: [
        {
          items: [
            choice("rod_run_flat", "Run Flat?", SIM_NAO),
            tire("pneu_estepe", "Estepe", "pneu_estepe_marca", "pneu_estepe_ref"),
            tire("pneu_de", "Dianteiro Esquerdo", "pneu_de_marca", "pneu_de_ref"),
            tire("pneu_te", "Traseiro Esquerdo", "pneu_te_marca", "pneu_te_ref"),
            tire("pneu_dd", "Dianteiro Direito", "pneu_dd_marca", "pneu_dd_ref"),
            tire("pneu_td", "Traseiro Direito", "pneu_td_marca", "pneu_td_ref"),
          ],
        },
      ],
    },
    {
      id: "rodas",
      title: "RODA",
      blocks: [
        {
          items: [
            wheel("rod_estepe", "Estepe"),
            wheel("rod_de", "Dianteira Esquerda"),
            wheel("rod_te", "Traseira Esquerda"),
            wheel("rod_dd", "Dianteira Direita"),
            wheel("rod_td", "Traseira Direita"),
          ],
        },
      ],
    },
    {
      id: "calota",
      title: "CALOTA",
      blocks: [
        {
          items: [
            choice("calota_possui", "Possui calota?", SIM_NAO),
            calota("calota_estepe", "Estepe"),
            calota("calota_de", "Dianteira Esquerda"),
            calota("calota_te", "Traseira Esquerda"),
            calota("calota_dd", "Dianteira Direita"),
            calota("calota_td", "Traseira Direita"),
          ],
        },
      ],
    },
    {
      id: "interior",
      title: "INTERIOR DO VEÍCULO",
      blocks: [
        {
          items: [
            body("interno_assoalho", "Assoalho"),
            body("int_tapete_motorista", "Tapete motorista"),
            body("int_tapete_passageiro", "Tapete passageiro"),
            body("int_tapete_tld", "Tapete TLD"),
            body("int_tapete_tle", "Tapete TLE"),
            body("interno_painel", "Painel/console"),
            body("int_banco_motorista", "Banco dianteiro motorista"),
            body("int_banco_passageiro", "Banco dianteiro passageiro"),
            body("interno_bancos_baixos", "Banco traseiro"),
            body("interno_encosto_cabeca", "Encosto de cabeça"),
            body("int_rev_dld", "Revestimento de porta DLD"),
            body("int_rev_dle", "Revestimento de porta DLE"),
            body("int_rev_tld", "Revestimento de porta TLD"),
            body("int_rev_tle", "Revestimento de porta TLE"),
            body("int_teto", "Teto"),
            body("interno_porta_luvas", "Porta-luvas"),
            body("int_parasol_motorista", "Para-sol motorista"),
            body("int_parasol_passageiro", "Para-sol passageiro"),
            cls("interno_acendedor", "Acendedor de cigarro"),
            cls("eq_buzina", "Buzina"),
          ],
        },
      ],
    },
    {
      id: "pertences",
      title: "PERTENCES DO FINANCIADO",
      blocks: [
        {
          items: [
            choice("ini_pertences", "Pertences do financiado?", SIM_NAO, {
              textKey: "ini_pertences_quais",
              textLabel: "Quais?",
              textPlaceholder: "Descreva os pertences",
              textWhen: "SIM",
            }),
          ],
        },
      ],
    },
    {
      id: "equipamentos",
      title: "EQUIPAMENTOS E ACESSÓRIOS",
      blocks: [
        {
          items: [
            cls("eq_multimidia", "Central multimídia"),
            cls("eq_cd", "Toca CD"),
            cls("eq_toca_fitas", "Toca fita"),
            cls("eq_radio", "Rádio"),
            cls("eq_alto_falantes", "Auto falante"),
            cls("eq_modulo_som", "Módulo"),
            cls("eq_teto_solar", "Teto solar"),
            cls("eq_bagageiro_teto", "Bagageiro de teto"),
            cls("eq_camera_re", "Câmera de ré"),
            cls("eq_kit_gas", "Kit GNV"),
            body("eq_banco_couro", "Banco de couro"),
            body("eq_antena", "Antena interna"),
            txt("eq_marca", "Marca"),
          ],
        },
      ],
    },
    {
      id: "seguranca",
      title: "EQUIPAMENTOS DE SEGURANÇA",
      blocks: [
        {
          items: [
            cls("interno_extintor", "Extintor"),
            cls("interno_chave_roda", "Chave de rodas"),
            cls("interno_macaco", "Macaco"),
            cls("interno_triangulo", "Triângulo"),
            cls("interno_cinto_seguranca", "Cintos de segurança"),
          ],
        },
      ],
    },
  ];

  const EIXO_CARD = {
    id: "eixo",
    title: "QUANTIDADE DE EIXO",
    blocks: [
      {
        items: [
          cls("eixo_toco", "Toco"),
          cls("eixo_trucado", "Trucado"),
          cls("eixo_3_trucado", "3º eixo Trucado"),
          cls("eixo_outros", "Outros"),
        ],
      },
    ],
  };

  const CARROCERIA_CARD = {
    id: "carroceria",
    title: "TIPO DE CARROCERIA",
    blocks: [
      {
        items: [
          cls("car_bau_isotermico", "Baú Isotérmico"),
          cls("car_graneleira", "Graneleira"),
          cls("car_aberta", "Aberta"),
          cls("car_cacamba", "Caçamba"),
          cls("car_tanque", "Tanque"),
        ],
      },
    ],
  };

  const MOTOS_CARDS = [
    LEVE_CARDS[0],
    {
      id: "motos",
      title: "MOTOS",
      blocks: [
        {
          items: [
            cls("moto_carenagem", "Carenagem"),
            cls("moto_guidao", "Guidão"),
            cls("moto_tanque", "Tanque"),
            cls("moto_lateral", "Lateral"),
          ],
        },
        {
          items: [
            cls("moto_setas", "Setas"),
            cls("moto_pedaleira", "Pedaleira"),
            cls("moto_freio_manete", "Freio Manete/Pedaleira"),
            cls("moto_suporte_descanso", "Suporte de Descanso"),
          ],
        },
        {
          items: [
            cls("moto_corrente", "Corrente"),
            cls("moto_escapamento", "Escapamento"),
            cls("moto_lanterna_traseira", "Lanterna Traseira"),
            cls("moto_farol", "Farol"),
          ],
        },
      ],
    },
  ];

  const TRATORES_CARDS = [
    LEVE_CARDS[0],
    {
      id: "tratores",
      title: "TRATORES E MÁQUINAS AGRÍCOLAS",
      blocks: [
        {
          items: [
            cls("trat_pneus", "Pneus"),
            cls("trat_eixo_diant_4x2", "Eixo Dianteiro 4X2"),
            cls("trat_eixo_diant_4x4", "Eixo Dianteiro 4X4"),
            cls("trat_embreagem", "Embreagem"),
            cls("trat_cambio", "Câmbio"),
            cls("trat_motor", "Motor"),
          ],
        },
        {
          title: "TIPO",
          items: [
            cls("trat_dir_mecanica", "Direção Mecânica"),
            cls("trat_dir_hidraulica", "Direção Hidráulica/Hidrostática"),
            cls("trat_freios", "Freios"),
            cls("trat_freios_umido", "Freios — Úmido"),
            cls("trat_freios_seco", "Freios — Seco"),
            cls("trat_eixo_traseiro", "Eixo Traseiro — Diferencial"),
            cls("trat_lataria", "Lataria"),
            cls("trat_pintura", "Pintura"),
          ],
        },
        {
          items: [
            cls("trat_eletrica", "Elétrica"),
            cls("trat_barra_tracao", "Barra de Tração"),
            cls("trat_assento_operador", "Assento Operador"),
            cls("trat_cabine", "Cabine"),
            cls("trat_para_choque", "Para-Choque"),
            cls("trat_bracos_hidraulicos", "Braços Hidráulicos"),
          ],
        },
      ],
    },
  ];

  const PESADOS_CARDS = [...LEVE_CARDS, EIXO_CARD, CARROCERIA_CARD];

  const VARIANT_META = {
    LEVE: {
      id: "LEVE",
      label: "Vistoria Leve",
      shortLabel: "Leve",
      description: "Carros de passeio, veículos leves e pequenas vans.",
      diagram: DIAGRAMS.LEVE,
      photoProfile: "LEVE",
      ready: true,
    },
    PESADOS: {
      id: "PESADOS",
      label: "Vistoria Pesados",
      shortLabel: "Pesados",
      description: "Vans maiores, ônibus, caminhões, carretas e veículos pesados.",
      diagram: DIAGRAMS.PESADOS,
      photoProfile: "PESADOS",
      ready: true,
    },
    TRATORES: {
      id: "TRATORES",
      label: "Tratores e Máquinas Agrícolas",
      shortLabel: "Tratores / Máquinas",
      description: "Tratores, máquinas e equipamentos agrícolas.",
      diagram: DIAGRAMS.TRATORES,
      photoProfile: "TRATORES",
      ready: true,
    },
    MOTOS: {
      id: "MOTOS",
      label: "Vistoria Motos",
      shortLabel: "Motos",
      description: "Motocicletas e motos.",
      diagram: DIAGRAMS.MOTOS,
      photoProfile: "MOTOS",
      ready: true,
    },
  };

  const VARIANT_CARDS = {
    LEVE: LEVE_CARDS,
    PESADOS: PESADOS_CARDS,
    TRATORES: TRATORES_CARDS,
    MOTOS: MOTOS_CARDS,
  };

  const FUEL_GAUGE_VB = { w: 360, h: 150 };

  function parseFuelMark(raw) {
    if (!raw) return null;
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    if (typeof value !== "object") return null;
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function fuelMarkFromSvgPoint(pt) {
    if (!pt || !Number.isFinite(Number(pt.cx)) || !Number.isFinite(Number(pt.cy))) return null;
    return {
      x: Math.round((Number(pt.cx) / FUEL_GAUGE_VB.w) * 1000) / 10,
      y: Math.round((Number(pt.cy) / FUEL_GAUGE_VB.h) * 1000) / 10,
    };
  }

  function fuelXMarkup(x, y) {
    const s = 11;
    return (
      `<g class="vei-fuel-x" transform="translate(${Number(x).toFixed(1)} ${Number(y).toFixed(1)})" style="pointer-events:none">` +
      `<line x1="${-s}" y1="${-s}" x2="${s}" y2="${s}" stroke="#dc2626" stroke-width="3.2" stroke-linecap="round"/>` +
      `<line x1="${s}" y1="${-s}" x2="${-s}" y2="${s}" stroke="#dc2626" stroke-width="3.2" stroke-linecap="round"/>` +
      `</g>`
    );
  }

  function renderFuelGaugeSvg(mark, opts) {
    const readOnly = !!(opts && opts.readOnly);
    const parsed = parseFuelMark(mark);
    const w = FUEL_GAUGE_VB.w;
    const h = FUEL_GAUGE_VB.h;
    const ticks = [
      { x: 48, label: "E", top: true },
      { x: 114, label: "1/4", top: false },
      { x: 180, label: "1/2", top: false },
      { x: 246, label: "3/4", top: false },
      { x: 312, label: "F", top: true },
    ];
    let ticksHtml = "";
    ticks.forEach((t) => {
      ticksHtml += `<line x1="${t.x}" y1="48" x2="${t.x}" y2="100" stroke="#0f172a" stroke-width="${t.top ? 2.4 : 1.6}"/>`;
      if (t.top) {
        ticksHtml += `<text x="${t.x}" y="38" text-anchor="middle" font-size="22" font-weight="800" fill="#0f172a" font-family="Arial, Helvetica, sans-serif">${t.label}</text>`;
      } else {
        ticksHtml += `<text x="${t.x}" y="118" text-anchor="middle" font-size="10" font-weight="700" fill="#475569" font-family="Arial, Helvetica, sans-serif">${t.label}</text>`;
      }
    });
    const xHtml = parsed ? fuelXMarkup((parsed.x / 100) * w, (parsed.y / 100) * h) : "";
    const cls = readOnly ? "vei-fuel-gauge vei-fuel-gauge--ro" : "vei-fuel-gauge";
    return (
      `<svg class="${cls}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nível de combustível">` +
      `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="#fff" stroke="#94a3b8" stroke-width="1.5"/>` +
      `<text x="${w / 2}" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b" font-family="Arial, Helvetica, sans-serif" letter-spacing="0.8">NÍVEL DE COMBUSTÍVEL</text>` +
      `<rect x="48" y="48" width="264" height="52" rx="6" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>` +
      ticksHtml +
      xHtml +
      `</svg>`
    );
  }

  function extraFields(it) {
    return {
      numberKey: it.numberKey || null,
      numberLabel: it.numberLabel || null,
      choiceKey: it.choiceKey || null,
      choiceLabel: it.choiceLabel || null,
      choices: it.choices || null,
      options: it.options || null,
      classIds: it.classIds || null,
      required: !!it.required,
      textKey: it.textKey || null,
      textLabel: it.textLabel || null,
      textPlaceholder: it.textPlaceholder || null,
      textKey2: it.textKey2 || null,
      textLabel2: it.textLabel2 || null,
      textPlaceholder2: it.textPlaceholder2 || null,
      textWhen: it.textWhen || null,
    };
  }

  function flattenCards(cards) {
    const checklist = [];
    cards.forEach((card) => {
      card.blocks.forEach((block) => {
        if (block.fuelGauge) {
          checklist.push({
            category: card.title,
            cardId: card.id,
            key: "ini_fuel_gauge",
            label: "Nível de combustível",
            kind: "fuel_gauge",
            required: true,
            blockTitle: block.title || null,
          });
        }
        (block.textFields || []).forEach((it) => {
          checklist.push({
            category: card.title,
            cardId: card.id,
            key: it.key,
            label: it.label,
            kind: it.kind,
            blockTitle: block.title || null,
          });
        });
        (block.items || []).forEach((it) => {
          checklist.push({
            category: card.title,
            cardId: card.id,
            key: it.key,
            label: it.label,
            kind: it.kind || "classify",
            blockTitle: block.title || null,
            ...extraFields(it),
          });
          if (it.numberKey) {
            checklist.push({
              category: card.title,
              cardId: card.id,
              key: it.numberKey,
              label: it.numberLabel || "Quantidade",
              kind: "number",
              parentKey: it.key,
              blockTitle: block.title || null,
            });
          }
        });
      });
    });
    return checklist;
  }

  function classifyKeysFromCards(cards) {
    return flattenCards(cards)
      .filter((it) => it.kind === "classify")
      .map((it) => it.key);
  }

  function getVariantConfig(variantId) {
    const id = String(variantId || "LEVE").toUpperCase();
    const meta = VARIANT_META[id] || VARIANT_META.LEVE;
    const cards = VARIANT_CARDS[id] || VARIANT_CARDS.LEVE;
    const checklist = flattenCards(cards);
    return {
      ...meta,
      cards,
      checklist,
      classifyKeys: classifyKeysFromCards(cards),
      cardCount: cards.length,
      itemCount: checklist.filter((it) => it.kind === "classify").length,
    };
  }

  const LEVE_CONFIG = getVariantConfig("LEVE");

  global.vehicleEntryInspectionChecklist = {
    INSPECTION_VARIANTS: Object.values(VARIANT_META),
    VARIANT_META,
    getVariantConfig,
    getDiagramSrc(variantId) {
      return getVariantConfig(variantId).diagram;
    },
    getVariantLabel(variantId) {
      return getVariantConfig(variantId).label;
    },
    INSPECTION_CARDS: LEVE_CONFIG.cards,
    CHECKLIST: LEVE_CONFIG.checklist,
    INSPECTION_CHECKLIST_KEYS: LEVE_CONFIG.classifyKeys,
    CARD_COUNT: LEVE_CONFIG.cardCount,
    ITEM_COUNT: LEVE_CONFIG.itemCount,
    FUEL_GAUGE_VB,
    parseFuelMark,
    fuelMarkFromSvgPoint,
    renderFuelGaugeSvg,
    LEVE_PHOTO_SLOTS: [
      { key: "diag_front_left", category: "EXTERIOR", label: "Dianteira diagonal esquerda" },
      { key: "diag_front_right", category: "EXTERIOR", label: "Dianteira diagonal direita" },
      { key: "side_left", category: "EXTERIOR", label: "Lateral esquerda" },
      { key: "side_right", category: "EXTERIOR", label: "Lateral direita" },
      { key: "diag_rear_right", category: "EXTERIOR", label: "Diagonal traseira direita" },
      { key: "diag_rear_left", category: "EXTERIOR", label: "Diagonal traseira esquerda" },
      { key: "roof", category: "EXTERIOR", label: "Teto" },
      { key: "dashboard_on", category: "INTERIOR", label: "Painel de instrumentos com o veículo ligado" },
      { key: "engine", category: "MECANICA", label: "Motor" },
      { key: "chassis", category: "IDENTIFICACAO", label: "Chassi" },
      { key: "battery", category: "MECANICA", label: "Bateria" },
      { key: "spare", category: "RODAS", label: "Estepe" },
      { key: "jack_tools", category: "ACESSORIOS", label: "Chave de rodas e triângulo juntos em uma única foto" },
      { key: "wheel_fr", category: "RODAS", label: "Roda dianteira direita" },
      { key: "wheel_fl", category: "RODAS", label: "Roda dianteira esquerda" },
      { key: "wheel_rr", category: "RODAS", label: "Roda traseira direita" },
      { key: "wheel_rl", category: "RODAS", label: "Roda traseira esquerda" },
      { key: "seats_front", category: "INTERIOR", label: "Bancos dianteiros" },
      { key: "seats_rear", category: "INTERIOR", label: "Bancos traseiros" },
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
