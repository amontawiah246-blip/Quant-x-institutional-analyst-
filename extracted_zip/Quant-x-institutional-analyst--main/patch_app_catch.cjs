const fs = require('fs');

let text = fs.readFileSync('src/App.tsx', 'utf8');

const old_catch = `    } catch (error: any) {
      console.error(error);
      setResult(\`**SYSTEM ERROR**\\n\\nFailed to complete analysis. \\n\\n\\\`\${error.message}\\\`\\n\\nPlease ensure your configuration and API limits are intact.\`);
    }`;

const new_catch = `    } catch (error: any) {
      console.error(error);
      if(error.name === 'AbortError') {
        setResult('**Request timed out** — Analysis took over 2 minutes. Please try again.');
      } else {
        setResult(\`**SYSTEM ERROR**\\n\\nFailed to complete analysis. \\n\\n\\\`\${error.message}\\\`\\n\\nPlease ensure your configuration and API limits are intact.\`);
      }
    }`;

text = text.replace(old_catch, new_catch);

fs.writeFileSync('src/App.tsx', text);
console.log('App.tsx catch block patched successfully.');
