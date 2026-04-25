fetch('https://zunopropect.com.br')
  .then(r => r.text())
  .then(t => {
    const m = t.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (m) {
      fetch('https://zunopropect.com.br' + m[1])
        .then(r => r.text())
        .then(js => {
          // Procurar por qualquer string .supabase.co
          const match = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
          if (match) {
            console.log('ENCONTRADO SUPABASE BUNDLED: ', match[0]);
          } else {
            console.log('NENHUMA URL DO SUPABASE NO BUNDLE JS.');
          }
        });
    } else {
      console.log('NO_JS_BUNDLE');
    }
  });
