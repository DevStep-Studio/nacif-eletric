import fs from "fs";
import https from "https";
import http from "http";
import path from "path";

const downloads = [
  {
    file: "idr-4p.jpg",
    url: "https://zennyt.com.br/wp-content/uploads/2025/04/interruptor_diferencial_residual_dr_tetrapolar_40a_30ma_weg_rdw_5311_1_252ec04780fce9d3ae8e6822fcb6c00d.jpg"
  },
  {
    file: "din-rail.jpg",
    url: "https://altex.com/cdn/shop/files/altex-preferred-mfg-din-rail-1m-35mm-x-75mm-slotted-aluminum-din-rail-564798.jpg"
  },
  {
    file: "busbar-phase.jpg",
    url: "https://5df841b7b6204c6b.cdn.gocache.net/images/1738202/master_barramento-pente-bifasico-para-disjuntor-80a-6-polos-legrand-928028-116623ec..jpg"
  },
  {
    file: "busbar-neutral.jpg",
    url: "https://www.abastece.com.br/cdn/shop/products/barramento_neutro_6_terminais_azul_sbn6_steck_89869346_0001_600x600_b3fbe835-dee6-4ec0-b538-8530a0b27303.jpg"
  },
  {
    file: "terminal-ferrule.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/terminal_tubular_ilhos_isolado_simples_1_5mm_vermelho_pct_c_100_unid_2159_1_0c5be63faea4bc1721516e87f3db5e90.jpg"
  },
  {
    file: "terminal-lug.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/terminal_olhal_pre_isolado_furo_m5_1_5_a_2_5mm_azul_pct_com_100_unidades_2181_1_c8d2ee31ee981297aa19741f05cefcfa.jpg"
  },
  {
    file: "connector-wago.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/conector_de_emenda_compacto_3_condutores_221_413_wago_873_1_eead13fec14782bb525bc8a594038a84.jpg"
  },
  {
    file: "terminal-block.jpg",
    url: "https://www.classicautomation.com/media/catalog/product/cache/6517c62f5899ad6aa0ba23ceb3eeff97/u/k/uk-10.jpg"
  },
  {
    file: "outlet.jpg",
    url: "https://cdn.awsli.com.br/600x450/454/454948/produto/194023350/tomada-2p-t-10a-branca-weg-pial-tramontina-xzghfwny9t.jpg"
  },
  {
    file: "switch.jpg",
    url: "https://cdn.leroymerlin.com.br/products/interruptor_simples_10a_branco_liz_tramontina_89471200_0001_600x600.jpg"
  },
  {
    file: "box-4x2.jpg",
    url: "https://cdn.awsli.com.br/600x450/1984/1984878/produto/155519996/caixa-de-luz-4x2-amarela-tigre-r5eg71rp3x.jpg"
  },
  {
    file: "box-4x4.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/caixa_de_luz_octogonal_fundo_movel_amarela_tigre_718_1_5bfa4e8ad8aeef1fcde5c742398453ae.jpg"
  },
  {
    file: "conduit-flexible.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/eletroduto_corrugado_flexivel_20mm_amarelo_rolo_50_metros_1103_1_458b5884218ddf9dcdd10ae0f676731d.jpg"
  },
  {
    file: "conduit-fittings.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/curva_90_graus_para_eletroduto_pvc_rosqueavel_3_4_preta_tigre_1085_1_2515bcefd3831671239c0fa168aeb1d9.jpg"
  },
  {
    file: "condulet.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/condulete_fixo_3_4_tipo_t_sem_rosca_com_tampa_cega_tramontina_1566_1_865be9f76a520a84eef8ca8a05c3162b.jpg"
  },
  {
    file: "fasteners-kit.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/bucha_nylon_com_anel_s6_com_parafuso_chipboard_pct_c_100_unid_2415_1_753c559868be52e72fcbb70094d40237.jpg"
  },
  {
    file: "tape-insulating.jpg",
    url: "https://images.tcdn.com.br/img/img_prod/1061963/fita_isolante_imperial_18mm_x_20m_preta_3m_942_1_b61c169222c1d3550e50337c6883f339.jpg"
  },
  {
    file: "wire-markers.jpg",
    url: "https://images.salsify.com/image/upload/s--6zSy4KGG--/e_trim/w_1190,h_1190,c_pad/bo_5px_solid_white/73a1d004f0d0ca77ef71a1bdf5ace89f476dc122.jpg"
  }
];

function download(item) {
  return new Promise((resolve) => {
    const client = item.url.startsWith("https") ? https : http;
    const req = client.get(item.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download({ file: item.file, url: res.headers.location }).then(resolve);
      }
      if (res.statusCode === 200) {
        const dest = path.resolve("public/products", item.file);
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`✓ Downloaded ${item.file}`);
          resolve(true);
        });
      } else {
        console.log(`✗ Failed ${item.file} status ${res.statusCode}`);
        resolve(false);
      }
    });
    req.on("error", (err) => {
      console.log(`✗ Error ${item.file}: ${err.message}`);
      resolve(false);
    });
  });
}

async function run() {
  fs.mkdirSync("public/products", { recursive: true });
  for (const item of downloads) {
    await download(item);
  }
}

run();
