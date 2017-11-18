// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
// 1 - Contract object - used for contract compilation and additional mapping
// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
var isBrowser = typeof window !== 'undefined';
var evmContract = function(options) {
  // if (!options.address) { throw new Error('Expected to have contract address'); }

  var loadSolc = isBrowser ? function(compiler, cb) { return BrowserSolc.loadVersion("soljson-" + compiler + ".js", cb); } : require('solc').loadRemoteVersion;
  var expected = ['source'];
 
  var events = {};
  this.on = function(event, callback) {
    events[event] = callback;
  };

  var json = {};
  var setJson = function(val) { 
    json = val; 
    if (typeof events.ready === 'function') { events.ready(json); }
  }

  if (options.source) {        
     if (options.compiler) {
	console.log("Loading compiler version: " + options.compiler);
     	loadSolc(options.compiler, function(solcCustom) {
           var compiled = solcCustom.compile(options.source, options.optimization ? 1 : 0);
	   setJson(compiled);
     	});
     } else { 
	throw new Error("Compiler version is not specified");
     }
  } else {
     throw new Error("Contract expects to have " + expected.join(" or "));
  } 
  return this;
};


// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
// 2 - watcher object - contains breakpoints
// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
var evmWatcher = function () {
  
  this.points = [];

  this.add = function(params) {
    if (!params.contract) { throw new Error("Expected contract as the 1st argument to add breakpoint"); }
    if (!params.lines) { throw new Error("Expected lines list to add breakpoint"); }
    this.points.push(params);
    return this;
  };

  var condition = function() {
    // (log.pc
    return 'true';
  };

  var data = function() {
    return 'JSON.stringify(log)';
  };

  // builds the options for debugTransaction - mainly the tracer string
  this.build = function() {                                                                                                   
     return '{data: [], step: function(log, db) { if('+ condition() + ') this.data.push('+ data() +'); }, result: function() { return this.data; }}';
  };

  return this;
};


// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
// 3 - Breakpoints iterator
// --- --- --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- ---  --- --- 
var evmDebugIterator = function(web3, txHash, logger, timeout) {
  if (typeof web3 !== 'object') { throw new Error('web3 is not passed to Debug Iterator'); }
  if (!txHash) { throw new Error('Transaction expected'); }
  if (typeof logger !== 'string') { throw new Error('Iterator expects logger as third parameter'); }
          
  // Injecting web3.debug - usually it is not provided
  // while it is available in RPC API                                                
  if (typeof(web3.debug) === 'undefined' ) {
    web3._extend({
      property: 'debug',
	methods: [new web3._extend.Method({
	   name: 'traceTransaction',
	   call: 'debug_traceTransaction',
	   params: 2,
           inputFormatter: [null, null]
	})]
    });
  };                                                                                           
 
  this.current = -1;

  // getting condition in the current breakpoint
  this.get = function() {
    return this.data[this.current];
  };	

  this.stopped = function() {
    return this.current == -1;
  };

  this.next = function() {
    this.current ++;
    if (this.current > this.data.length) this.current++;
  };

  this.data = web3.debug.traceTransaction(txHash, { tracer: logger, timeout: timeout || '1m' });
  return this;
};


var evm = {
   contract: evmContract,
   breakpoint: evmWatcher, 
   iterator: evmDebugIterator 
};
                             
if (typeof window !== 'undefined') {
    // exporting to web version - just by setting global ...
    window.evmBreakpoints = evm;
} else {
    // exporting for usage in server version
    module.exports  = evm;
}
