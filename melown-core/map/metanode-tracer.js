/**
 * @constructor
 */
Melown.MapMetanodeTracer = function(mapTree_, surface_, nodeProcessingFunction_) {
    this.map_ = mapTree_.map_;
    this.surfaceTree_ = mapTree_.surfaceTree_;
    this.metastorageTree_ = mapTree_.metastorageTree_;
    this.metaBinaryOrder_ = mapTree_.metaBinaryOrder_;
    this.rootId_ = mapTree_.rootId_;
    this.surface_ = surface_; //????
    this.nodeProcessingFunction_ = nodeProcessingFunction_;
    this.params_ = null;
};

Melown.MapMetanodeTracer.prototype.trace = function(tile_, params_) {
    this.params_ = params_;
    this.traceTile(this.surfaceTree_);
};

Melown.MapMetanodeTracer.prototype.traceTile = function(tile_) {
    if (tile_ == null) {
        return;
    }

    if (tile_.surface_ == null) {
        this.checkTileSurface(tile_);
    }

    if (tile_.metastorage_ == null) {
        tile_.metastorage_ = Melown.FindMetastorage(this.map_, this.metastorageTree_, this.rootId_, tile_, this.metaBinaryOrder_);
    }

    if (tile_.metanode_ == null) {
        if (tile_.virtual_) {
            if (!this.isVirtualMetanodeReady(tile_) ){
                return;
            }
        }

        var surface_ = this.surface_ || tile_.surface_;
        if (surface_ == null) {
            return;
        }

        var metatile_ = tile_.metastorage_.getMetatile(surface_);

        if (metatile_ == null) {
            metatile_ = new Melown.MapMetatile(tile_.metastorage_, surface_);
            tile_.metastorage_.addMetatile(metatile_);
        }

        if (metatile_.isReady() == true) {
            tile_.metanode_ = metatile_.getNode(tile_.id_);

            if (tile_.metanode_ != null) {
                /*
                if (tile_.id_[0] == 15) {
                    tile_ = tile_;
                }*/

                tile_.metanode_.tile_ = tile_; //used only for validate

                for (var i = 0; i < 4; i++) {
                    if (tile_.metanode_.hasChild(i) == true) {
                        tile_.addChild(i);
                    } else {
                        tile_.removeChildByIndex(i);
                    }
                }
            }

        } else {
            return;
        }
    }

    if (tile_.metanode_ == null) { //only for wrong data
        return;
    }

    tile_.metanode_.metatile_.used();

    //if (tile_.id_[0] == 17) {
        //tile_ = tile_;
    //}

    if (this.nodeProcessingFunction_(tile_, this.params_) == true) {

        if (this.params_ && this.params_.traceHeight_) {
            var coords_ = this.params_.coords_;
            var extents_ = this.params_.extents_;
            var center_ = [(extents_.ll_[0] + extents_.ur_[0]) *0.5,
                           (extents_.ll_[1] + extents_.ur_[1]) *0.5];

            //ul,ur,ll,lr

            var right_ = (coords_[0] >= center_[0]);
            var bottom_ = (coords_[1] >= center_[1]);

            if (right_) {
                extents_.ll_[0] = center_[0];
                if (bottom_) {
                    extents_.ll_[1] = center_[1];
                } else {
                    extents_.ur_[1] = center_[1];
                }
            } else {
                extents_.ur_[0] = center_[0];
                if (bottom_) {
                    extents_.ll_[1] = center_[1];
                } else {
                    extents_.ur_[1] = center_[1];
                }
            }

            /*
            if (extents_.ll_[0] > extents_.ur_[0]) {
                right_ = !right_;
            }

            if (extents_.ll_[1] < extents_.ur_[1]) {
                bottom_ = !bottom_;
            }*/

            if (right_) {
                if (bottom_) {
                    this.traceTile(tile_.children_[1]);
                } else {
                    this.traceTile(tile_.children_[3]);
                }

            } else {
                if (bottom_) {
                    this.traceTile(tile_.children_[0]);
                } else {
                    this.traceTile(tile_.children_[2]);
                }
            }


        } else {
            //trace children
            for (var i = 0; i < 4; i++) {
                this.traceTile(tile_.children_[i]);
            }
        }
    }
};

Melown.MapMetanodeTracer.prototype.checkTileSurface = function(tile_) {
    tile_.surface_ = null;
    tile_.virtual_ = false;
    tile_.virtualReady_ = false;
    tile_.virtualSurfaces_ = [];

    var sequence_ = this.map_.surfaceSequence_;

    //find surfaces with content
    for (var i = sequence_.length - 1; i >= 0; i--) {
        var res_ = sequence_[i].hasTile2(tile_.id_);
        if (res_[0] == true) {

            var surface_ = sequence_[i];
            
            //check if tile exist
            if (tile_.id_[0] > surface_.lodRange_[0]) {
                var parent_ = tile_.parent_;
                var metatile_ = parent_.metastorage_.getMetatile(surface_);
                if (metatile_) {
                    var node_ = metatile_.getNode(parent_.id_);
                    if (node_) {
                        if (!node_.hasChildById(tile_.id_)) {
                            continue;
                        }
                    }
                }
            }

            //set top most surface
            if (tile_.surface_ == null && res_[1] == false) {
                //reset tile data
                if (tile_.surface_ != surface_) {
                    tile_.surfaceMesh_ = null;
                    tile_.surfaceTexture_ = null;
                    tile_.surfaceGeodata_ = null;
                    tile_.heightMap_ = null;
                }
    
                tile_.surface_ = surface_;
                tile_.empty_ = false;
            }
    
            //store surface
            tile_.virtualSurfaces_.push(surface_);        
        }
    }

    if (tile_.surface_ != null) {
        if (tile_.virtualSurfaces_.length > 1) {
            tile_.virtual_ = true;
        }
        
        return;
    }

    //find surfaces with metatile
    for (var i = sequence_.length - 1; i >= 0; i--) {
        if (sequence_[i].hasMetatile(tile_.id_) == true) {

            var surface_ = sequence_[i];

            //reset tile data
            if (tile_.surface_ != surface_) {
                tile_.surfaceMesh_ = null;
                tile_.surfaceTexture_ = null;
                tile_.surfaceGeodata_ = null;
                tile_.heightMap_ = null;
            }

            tile_.surface_ = surface_;
            tile_.empty_ = true;

            return;
        }
    }

};

Melown.MapMetanodeTracer.prototype.isVirtualMetanodeReady = function(tile_) {
    var surfaces_ = tile_.virtualSurfaces_;
    var readyCount_ = 0;

    for (var i = 0, li = surfaces_.length; i < li; i++) {
        var surface_ = surfaces_[i];
        var metatile_ = tile_.metastorage_.getMetatile(surface_);

        if (metatile_ == null) {
            metatile_ = new Melown.MapMetatile(tile_.metastorage_, surface_);
            tile_.metastorage_.addMetatile(metatile_);
        }

        if (metatile_.isReady() == true) {
            readyCount_++;
        }
    }
    
    if (readyCount_ == li) {
        tile_.metanode_ = this.createVirtualMetanode(tile_);
        return true;        
    } else {
        return false;
    }
};

Melown.MapMetanodeTracer.prototype.createVirtualMetanode = function(tile_) {
    var surfaces_ = tile_.virtualSurfaces_;
    var first_ = false;
    var node_ = null;

    for (var i = 0, li = surfaces_.length; i < li; i++) {
        var surface_ = surfaces_[i];
        var metatile_ = tile_.metastorage_.getMetatile(surface_);

        if (metatile_.isReady() == true) {
            var metanode_ = metatile_.getNode(tile_.id_);

            if (metanode_ != null) {
                if (!node_) {
                    node_ = metanode_.clone(); 
                } else {
                    node_.flags_ |= metanode_.flags_ & ((15)<<4); 
                    node_.bbox_.min_[0] = Math.min(node_.bbox_.min_[0], metatile_.bbox_.min_[0]); 
                    node_.bbox_.min_[1] = Math.min(node_.bbox_.min_[1], metatile_.bbox_.min_[1]); 
                    node_.bbox_.min_[2] = Math.min(node_.bbox_.min_[2], metatile_.bbox_.min_[2]); 
                    node_.bbox_.max_[0] = Math.max(node_.bbox_.max_[0], metatile_.bbox_.max_[0]); 
                    node_.bbox_.max_[1] = Math.max(node_.bbox_.max_[1], metatile_.bbox_.max_[1]); 
                    node_.bbox_.max_[2] = Math.max(node_.bbox_.max_[2], metatile_.bbox_.max_[2]); 
                }
            }
        }
    }
    
    return node_;
};







