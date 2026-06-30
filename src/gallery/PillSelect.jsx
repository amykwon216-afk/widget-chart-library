import React from 'react';
import { DexDropdownMenu, DexDropdownMenuItem, DexIcon } from '../mocks/dex-react/index.jsx';
import { tokens } from '../styles/tokens.js';
import { ce } from '../lib/chartHelpers.js';

export default function PillSelect({ value, options, onChange, renderValue, renderOption, open, onOpenChange }) {
  var btnContent = renderValue ? renderValue(value) : value;
  var items = ce(React.Fragment, null,
    options.map(function(opt) {
      var isA = opt === value;
      var leading = renderOption ? renderOption(opt, isA) : null;
      return ce(DexDropdownMenuItem, {key:opt, title:opt, leading:leading, selected:isA, onSelect:function(){if(!isA)onChange(opt);}});
    })
  );
  return ce(DexDropdownMenu, {size:"dense", side:"bottom", align:"start", content:items, open:open, onOpenChange:onOpenChange},
    ce("button", {
      style:{display:"inline-flex",alignItems:"center",gap:tokens.spacing.xs,padding:"3px 8px 3px 9px",borderRadius:999,fontSize:11,fontWeight:600,border:"none",background:tokens.colors.ui.buttonHover,color:tokens.colors.ui.bodyText,cursor:"pointer",fontFamily:"inherit",lineHeight:1,whiteSpace:"nowrap",height:24,boxSizing:"border-box"},
      onMouseEnter:function(e){e.currentTarget.style.background="var(--dex-bgColor-alpha-emphasis-hover)";},
      onMouseLeave:function(e){e.currentTarget.style.background=tokens.colors.ui.buttonHover;}
    },
      ce("span",{style:{display:"inline-flex",alignItems:"center",gap:tokens.spacing.xs}},btnContent),
      ce("span",{style:{display:"inline-flex",alignItems:"center"}},ce(DexIcon,{name:"chevron-down",size:"xs"}))
    )
  );
}
