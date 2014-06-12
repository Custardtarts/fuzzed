Vagrant::Config.run do |config|
    config.vm.box = "ubuntu/trusty32"
    config.vm.network :hostonly, "192.168.33.10"
    config.vm.share_folder  "fuzztrees", "/home/vagrant/fuzztrees", "."
    # If the VM has no internet connectivity, uncomment this line:
    # config.vm.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    # config.vm.customize ["modifyvm", :id, "--natdnsproxy1", "on"]
    config.vm.provision "ansible" do |ansible|
        ansible.playbook = "ansible/site.yml"
        ansible.extra_vars = { ansible_ssh_user: 'vagrant' }
        ansible.sudo = true
#       ansible.verbose = "vvvv"
        ansible.groups = {
                           "devmachine" => ["default"]
        }        
    end
end
