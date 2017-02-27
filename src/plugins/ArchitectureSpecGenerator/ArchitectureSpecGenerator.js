/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 1.7.0 from webgme on Sun Feb 19 2017 20:48:34 GMT-0600 (CST).
 * A plugin that inherits from the PluginBase. To see source code documentation about available
 * properties and methods visit %host%/docs/source/PluginBase.html.
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
        PluginConfig,
        pluginMetadata,
        PluginBase) {
    'use strict';
    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ArchitectureSpecGenerator.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ArchitectureSpecGenerator.
     * @constructor
     */
    var ArchitectureSpecGenerator = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ArchitectureSpecGenerator.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ArchitectureSpecGenerator.prototype = Object.create(PluginBase.prototype);
    ArchitectureSpecGenerator.prototype.constructor = ArchitectureSpecGenerator;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ArchitectureSpecGenerator.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
                nodeObject;

        nodeObject = self.activeNode;

        self.loadNodeMap(nodeObject)
                .then(function (nodes) {
                    self.logger.debug(Object.keys(nodes));
                    self.generateMacros(self.generateArchitectureModel(nodes));
                    self.result.setSuccess(true);
                    callback(null, self.result);
                })
                .catch(function (err) {
                    self.logger.error(err.stack);
                    // Result success is false at invocation.
                    callback(err, self.result);
                });
    };

    ArchitectureSpecGenerator.prototype.loadNodeMap = function (node) {
        var self = this;
        return self.core.loadSubTree(node)
                .then(function (nodeArr) {
                    var nodes = {},
                            i;
                    for (i = 0; i < nodeArr.length; i += 1) {
                        nodes[self.core.getPath(nodeArr[i])] = nodeArr[i];
                    }
                    return nodes;
                });
    };
    
    ArchitectureSpecGenerator.prototype.generateMacros = function (architectureModel){
        var self = this; 
        
        
        for (var port of architectureModel.ports) {
            var require = new Set;
            var accept = new Set;
            
            for (var connectorEnd of port.connectorEnds)
                if (!connectorEnd.hasOwnProperty('connector')) {
                    require.add("-");
                    accept.add("-");
                    break;
                }
            for (var connector of port.connectors) {
                var connectorEnd;
                for (var end of connector.ends)
                    if (end.port === port)
                        connectorEnd = end; 
                if (connectorEnd.multiplicity !== '1')
                    for (var otherConnectorEnd of connector.ends)
                        accept.add(otherConnectorEnd.port.name);
                else 
                   for (var otherConnectorEnd of connector.ends)
                        if (otherConnectorEnd.port.name !== port.name)
                            accept.add(otherConnectorEnd.port.name);
                if (connectorEnd.type === 'Trigger'){
                        require.add("-");
                        //require.add(';');
                    }
                else {
                    var triggerExists = false;
                    for (var otherConnectorEnd of connector.ends) {
                        if (otherConnectorEnd.type === 'Trigger')
                            triggerExists = true;
                    }
                    for (var otherConnectorEnd of connector.ends) {
                        if (triggerExists === false){
                            if (otherConnectorEnd.port.name !== port.name || parseInt(otherConnectorEnd.multiplicity) >1 ) {
                                for (var i = 0; i < parseInt(otherConnectorEnd.multiplicity); i++)
                                    require.add(otherConnectorEnd.port.name);
                                //require.add(';');
                            }
                        }
                        else{
                            if (otherConnectorEnd.type === 'Trigger' && (otherConnectorEnd.port.name !== port.name || parseInt(otherConnectorEnd.multiplicity) >1 )){
                                for (var i = 0; i < parseInt(otherConnectorEnd.multiplicity); i++)
                                    require.add(otherConnectorEnd.port.name);
                                //require.add(';');
                            }
                        }
                    }
                }
            }
            //for debugging
            self.logger.info("port: "+port.name);
            for (var req of require)
                self.logger.info("requires "+ req);
            for (var acc of accept)
                self.logger.info("accepts "+ acc);
            
            port.require = require;
            port.accept = accept;
        }
        return architectureModel.ports;
    };
    
    ArchitectureSpecGenerator.prototype.generateArchitectureModel = function (nodes) {
        var self = this,
                architectureModel = {
                    ports: [],
                    connectors: [],
                    connectorEnds: []
                };
        
        for (var path in nodes) {
            var node = nodes[path];
            if (self.isMetaTypeOf(node, self.META.EnforceableTransition)) {
                architectureModel.ports.push(node);
                node.name = self.core.getAttribute(node, 'name');
            }
            else if (self.isMetaTypeOf(node, self.META.Connector)) {
                if (self.getMetaType(nodes[self.core.getPointerPath(node, 'dst')]) !== self.META.Join) {
                    architectureModel.connectors.push(node); 
                    var srcConnectorEnd = nodes[self.core.getPointerPath(node, 'src')];
                    var dstConnectorEnd = nodes[self.core.getPointerPath(node, 'dst')];
                    srcConnectorEnd.connector = node;
                    dstConnectorEnd.connector = node;
                    node.ends = [srcConnectorEnd, dstConnectorEnd];
                }
            }
            else if (self.isMetaTypeOf(node, self.META.Join)) {
                architectureModel.connectors.push(node);
                node.ends = [];
                for (var pathConnector in nodes) {
                    var nodeConnector = nodes[pathConnector];
                    if (self.isMetaTypeOf(nodeConnector, self.META.Connector) 
                            && nodes[self.core.getPointerPath(nodeConnector, 'dst')] === node) {
                        var srcConnectorEnd = nodes[self.core.getPointerPath(nodeConnector, 'src')];
                        srcConnectorEnd.connector = node;
                        node.ends.push(srcConnectorEnd);
                    }
                }
            }
            else if (self.isMetaTypeOf(node, self.META.Connection) && self.getMetaType(node) !== node) {
                var connectorEnd = nodes[self.core.getPointerPath(node, 'src')];
                architectureModel.connectorEnds.push(connectorEnd);
                var port = nodes[self.core.getPointerPath(node, 'dst')];
                connectorEnd.port = port;
                if (!port.hasOwnProperty("connectorEnds"))
                    port.connectorEnds = [];
                port.connectorEnds.push(connectorEnd);
                connectorEnd.type = self.core.getAttribute(connectorEnd, 'name');
                connectorEnd.degree = self.core.getAttribute(connectorEnd, 'Degree');
                connectorEnd.multiplicity = self.core.getAttribute(connectorEnd, 'Multiplicity');
            }
        }

        for (var port of architectureModel.ports) {
            port.connectors = new Set();
            for (var connectorEnd of port.connectorEnds) {
                //self.logger.info(connectorEnd.connector);
                if (connectorEnd.hasOwnProperty('connector'))
                  port.connectors.add(connectorEnd.connector);
            }
        }
        
        //For debugging
//        for (var port of architectureModel.ports){
//            self.logger.info("port: "+self.core.getAttribute(port, 'name'));
//            
//            for (var connectorEnd of port.connectorEnds){
//                self.logger.info("end type: "+ self.core.getAttribute(connectorEnd, 'name') +" multiplicity: "+ self.core.getAttribute(connectorEnd, 'Multiplicity') +" and degree: "+ self.core.getAttribute(connectorEnd, 'Degree'));
//            }
//        }
        return architectureModel;       
    };

    return ArchitectureSpecGenerator;
});


